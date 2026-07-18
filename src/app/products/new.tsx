import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Fragment } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Text } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/screen';
import { Field, PrimaryButton, textStyles } from '@/components/ui';
import { createProductWithVariant } from '@/database/repository';
import { useSync } from '@/providers/sync-provider';
import { rupeesToPaise } from '@/utils/currency';

const schema = z.object({
  productName: z.string().trim().min(2, 'Enter a product name'),
  category: z.string().trim().min(2, 'Enter a category'),
  brand: z.string(),
  variantName: z.string().trim().min(2, 'Enter the model and colour'),
  sku: z.string().trim().min(2, 'Enter a unique SKU'),
  purchasePrice: z.string().refine((value) => Number(value) >= 0, 'Enter a valid price'),
  sellingPrice: z.string().refine((value) => Number(value) > 0, 'Enter a valid price'),
  stockQuantity: z.string().refine((value) => Number.isInteger(Number(value)) && Number(value) >= 0, 'Enter a whole number'),
  lowStockThreshold: z.string().refine((value) => Number.isInteger(Number(value)) && Number(value) >= 0, 'Enter a whole number'),
});
type FormValues = z.infer<typeof schema>;

export default function NewProductScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { syncNow } = useSync();
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { productName: '', category: '', brand: '', variantName: '', sku: '', purchasePrice: '', sellingPrice: '', stockQuantity: '0', lowStockThreshold: '3' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await createProductWithVariant(db, {
        ...values,
        purchasePricePaise: rupeesToPaise(values.purchasePrice),
        sellingPricePaise: rupeesToPaise(values.sellingPrice),
        stockQuantity: Number(values.stockQuantity),
        lowStockThreshold: Number(values.lowStockThreshold),
      });
      await syncNow().catch(() => undefined);
      router.back();
    } catch (error) {
      Alert.alert('Could not add product', error instanceof Error ? error.message : 'Please try again.');
    }
  });

  const fields: { name: keyof FormValues; label: string; placeholder: string; numeric?: boolean; section?: string }[] = [
    { name: 'productName', label: 'Product name', placeholder: 'iPhone 17 Cover', section: '1. Tell us about the product' },
    { name: 'category', label: 'Category', placeholder: 'Phone Covers' },
    { name: 'brand', label: 'Brand (optional)', placeholder: 'Generic' },
    { name: 'variantName', label: 'Model and colour', placeholder: 'Pro Max / Black', section: '2. Add the first type' },
    { name: 'sku', label: 'SKU', placeholder: 'IP17-PM-BLK' },
    { name: 'purchasePrice', label: 'Price you paid (₹)', placeholder: '250', numeric: true, section: '3. Set price and stock' },
    { name: 'sellingPrice', label: 'Selling price (₹)', placeholder: '499', numeric: true },
    { name: 'stockQuantity', label: 'Opening stock', placeholder: '10', numeric: true },
    { name: 'lowStockThreshold', label: 'Low-stock alert at', placeholder: '3', numeric: true },
  ];

  return (
    <Screen>
      <Text style={textStyles.heading}>Add a product</Text>
      <Text style={textStyles.muted}>Fill in the details below. A QR code will be made automatically.</Text>
      {fields.map((field) => (
        <Fragment key={field.name}>
          {field.section ? <Text style={textStyles.eyebrow}>{field.section}</Text> : null}
          <Controller control={control} name={field.name} render={({ field: input }) => (
            <Field label={field.label} placeholder={field.placeholder} value={input.value} onChangeText={input.onChange} onBlur={input.onBlur} keyboardType={field.numeric ? 'decimal-pad' : 'default'} autoCapitalize={field.name === 'sku' ? 'characters' : 'sentences'} error={errors[field.name]?.message} returnKeyType="next" />
          )} />
        </Fragment>
      ))}
      <PrimaryButton label={isSubmitting ? 'Saving…' : 'Save product and make QR'} onPress={submit} disabled={isSubmitting} />
    </Screen>
  );
}

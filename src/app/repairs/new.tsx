import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Fragment } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Text } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/screen';
import { Field, PrimaryButton, textStyles } from '@/components/ui';
import { createRepairJob } from '@/database/repository';
import { useSync } from '@/providers/sync-provider';
import { rupeesToPaise } from '@/utils/currency';

const schema = z.object({
  customerName: z.string().trim().min(2, 'Enter the customer name'),
  phone: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit mobile number'),
  alternatePhone: z.string().trim().refine((value) => !value || /^\d{10}$/.test(value), 'Enter a 10-digit number'),
  deviceName: z.string().trim().min(2, 'Enter the device name or model'),
  issue: z.string().trim().min(3, 'Describe the repair problem'),
  accessoriesReceived: z.string(), conditionNotes: z.string(),
  estimatedCost: z.string().refine((value) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0, 'Enter a valid amount'),
  advance: z.string().refine((value) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0, 'Enter a valid amount'),
  promisedDate: z.string(), notes: z.string(),
});
type Values = z.infer<typeof schema>;

export default function NewRepairScreen() {
  const db = useSQLiteContext(); const router = useRouter(); const { syncNow } = useSync();
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { customerName: '', phone: '', alternatePhone: '', deviceName: '', issue: '', accessoriesReceived: '', conditionNotes: '', estimatedCost: '0', advance: '0', promisedDate: '', notes: '' } });
  const submit = handleSubmit(async (values) => {
    try {
      const repairId = await createRepairJob(db, { customerName: values.customerName, phone: values.phone, alternatePhone: values.alternatePhone || null, deviceName: values.deviceName, issue: values.issue, accessoriesReceived: values.accessoriesReceived || null, conditionNotes: values.conditionNotes || null, estimatedCostPaise: rupeesToPaise(values.estimatedCost), advancePaise: rupeesToPaise(values.advance), promisedDate: values.promisedDate || null, notes: values.notes || null });
      await syncNow().catch(() => undefined);
      router.replace({ pathname: '/repairs/[id]', params: { id: repairId } });
    } catch (error) { Alert.alert('Could not save repair', error instanceof Error ? error.message : 'Please try again.'); }
  });
  const fields: { name: keyof Values; label: string; placeholder: string; numeric?: boolean; multiline?: boolean; section?: string }[] = [
    { name: 'customerName', label: 'Customer name', placeholder: 'Rahul Sharma', section: '1. Customer details' }, { name: 'phone', label: 'Mobile number', placeholder: '9876543210', numeric: true }, { name: 'alternatePhone', label: 'Alternate number (optional)', placeholder: '10-digit number', numeric: true },
    { name: 'deviceName', label: 'Device and model', placeholder: 'Redmi Note 14 Pro', section: '2. Device left at shop' }, { name: 'issue', label: 'Problem to repair', placeholder: 'Display broken and touch not working', multiline: true }, { name: 'accessoriesReceived', label: 'Items left with device (optional)', placeholder: 'Charger, SIM tray, cover' }, { name: 'conditionNotes', label: 'Existing condition (optional)', placeholder: 'Scratch near camera', multiline: true },
    { name: 'estimatedCost', label: 'Estimated repair cost (₹)', placeholder: '1500', numeric: true, section: '3. Payment and delivery' }, { name: 'advance', label: 'Advance received (₹)', placeholder: '500', numeric: true }, { name: 'promisedDate', label: 'Expected delivery date (optional)', placeholder: '25/08/2026' }, { name: 'notes', label: 'Other note (optional)', placeholder: 'Call before replacing display', multiline: true },
  ];
  return <Screen><Text style={textStyles.heading}>Add customer repair</Text><Text style={textStyles.muted}>Record exactly what the customer left at the shop.</Text>{fields.map((field) => <Fragment key={field.name}>{field.section ? <Text style={textStyles.eyebrow}>{field.section}</Text> : null}<Controller control={control} name={field.name} render={({ field: input }) => <Field label={field.label} placeholder={field.placeholder} value={input.value} onChangeText={input.onChange} onBlur={input.onBlur} keyboardType={field.numeric ? 'number-pad' : 'default'} multiline={field.multiline} error={errors[field.name]?.message} returnKeyType={field.multiline ? 'default' : 'next'} />} /></Fragment>)}<PrimaryButton label={isSubmitting ? 'Saving repair…' : 'Save customer repair'} onPress={submit} disabled={isSubmitting} /></Screen>;
}

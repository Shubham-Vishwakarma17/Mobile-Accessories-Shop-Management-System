import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import type { InventoryVariant } from '@/types/domain';

export type QrLabelSelection = { variant: InventoryVariant; quantity: number };

const LABELS_PER_PAGE = 20;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

export async function createAndShareQrLabels(selections: QrLabelSelection[]) {
  const expanded = selections.flatMap(({ variant, quantity }) =>
    Array.from({ length: quantity }, () => variant),
  );
  if (!expanded.length) throw new Error('Select at least one QR label.');
  if (expanded.length > 200) throw new Error('Create up to 200 labels at one time.');

  const unique = new Map(expanded.map((variant) => [variant.id, variant]));
  const qrImages = new Map<string, string>();
  await Promise.all([...unique.values()].map(async (variant) => {
    qrImages.set(variant.id, await QRCode.toString(variant.qrValue, {
      type: 'svg', width: 320, margin: 1, errorCorrectionLevel: 'M',
    }));
  }));

  const pages = Array.from({ length: Math.ceil(expanded.length / LABELS_PER_PAGE) }, (_, pageIndex) => {
    const labels = expanded.slice(pageIndex * LABELS_PER_PAGE, (pageIndex + 1) * LABELS_PER_PAGE);
    return `<section class="page">${labels.map((variant) => `
      <article class="label">
        <div class="qrImage">${qrImages.get(variant.id)}</div>
        <div class="product">${escapeHtml(variant.productName)}</div>
        <div class="variant">${escapeHtml(variant.variantName)}</div>
        <div class="sku">${escapeHtml(variant.sku)}</div>
      </article>`).join('')}</section>`;
  }).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #152019; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; }
    .page { width: 194mm; min-height: 278mm; display: grid; grid-template-columns: repeat(4, 45mm); grid-auto-rows: 50mm; column-gap: 3mm; row-gap: 3mm; align-content: start; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .label { border: 0.3mm dashed #8d9991; border-radius: 2mm; padding: 2mm 1.5mm; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .qrImage, .qrImage svg { width: 29mm; height: 29mm; display: block; }
    .product { width: 100%; margin-top: 0.6mm; font-size: 8pt; line-height: 9pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .variant { width: 100%; font-size: 6.5pt; line-height: 7.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sku { width: 100%; color: #58635c; font-size: 5.5pt; line-height: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style></head><body>${pages}</body></html>`;

  const pageCount = Math.ceil(expanded.length / LABELS_PER_PAGE);
  try {
    const file = await Print.printToFileAsync({ html, width: 595, height: 842, base64: true });
    if (!file.base64 || !FileSystem.cacheDirectory) throw new Error('App storage is unavailable.');
    const shareableUri = `${FileSystem.cacheDirectory}qr-labels-${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(shareableUri, file.base64, { encoding: FileSystem.EncodingType.Base64 });
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable.');
    await Sharing.shareAsync(shareableUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save or share QR labels',
      UTI: 'com.adobe.pdf',
    });
    return { uri: shareableUri, labelCount: expanded.length, pageCount, delivery: 'shared' as const };
  } catch {
    await Print.printAsync({ html, width: 595, height: 842 });
    return { uri: null, labelCount: expanded.length, pageCount, delivery: 'print' as const };
  }
}

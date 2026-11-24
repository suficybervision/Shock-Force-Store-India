import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import { buildUpiPaymentUri, VALIDATION_PATTERNS } from '../types/store';

interface UpiQrCodeProps {
  upiId: string;
  merchantName: string;
  amount?: number;
  orderId?: string;
  note?: string;
  size?: number;
}

export const UpiQrCode: React.FC<UpiQrCodeProps> = ({
  upiId,
  merchantName,
  amount,
  orderId,
  note,
  size = 240,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string>('');

  const trimmedUpi = (upiId || '').trim();
  const isValidUpi = VALIDATION_PATTERNS.UPI_ID.test(trimmedUpi);
  const upiUri = isValidUpi
    ? buildUpiPaymentUri({
        upiId: trimmedUpi,
        merchantName,
        amount,
        orderId,
        note,
      })
    : '';

  useEffect(() => {
    let active = true;
    if (!upiUri) {
      setQrDataUrl('');
      setQrError(trimmedUpi ? 'Enter a valid UPI ID (e.g. name@bank).' : 'UPI ID is not configured.');
      return;
    }

    setQrError('');
    QRCode.toDataURL(upiUri, {
      width: size,
      margin: 2,
      color: {
        dark: '#0a0a0a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrError('Could not generate UPI QR code.');
      });

    return () => {
      active = false;
    };
  }, [upiUri, trimmedUpi, size]);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="aspect-square w-full max-w-[240px] border border-neutral-200 rounded-xl bg-white flex items-center justify-center overflow-hidden p-3">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`UPI QR code for ${trimmedUpi}${orderId ? ` order ${orderId}` : ''}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center p-4 space-y-2 text-neutral-500">
            <QrCode className="w-10 h-10 mx-auto text-neutral-400" />
            <p className="text-xs font-medium text-neutral-700">{qrError || 'Generating QR...'}</p>
          </div>
        )}
      </div>
      {upiUri && (
        <p className="mt-2 text-[10px] font-mono text-neutral-500 break-all text-center max-w-[260px]">
          {upiUri}
        </p>
      )}
    </div>
  );
};

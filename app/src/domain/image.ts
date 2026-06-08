export function resizeImageToDataUrl(file: File, maxPx = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxPx) {
          h = Math.round((h * maxPx) / w);
          w = maxPx;
        }
      } else if (h > maxPx) {
        w = Math.round((w * maxPx) / h);
        h = maxPx;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('no canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

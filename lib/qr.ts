import QRCode from "qrcode";

/*
 * Branded QR per lineup — encodes the public URL, downloadable. Near-free: the URL
 * already exists. Two-ink: warm-black modules on paper. Server-side.
 */
export async function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 480,
    color: { dark: "#15120dff", light: "#ede6d6ff" },
  });
}

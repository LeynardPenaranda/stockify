export async function uploadProductImage(opts: {
  idToken: string;
  productId: string;
  file: File;
}) {
  const signRes = await fetch("/api/admin/cloudinary/sign-product", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${opts.idToken}`,
    },
    body: JSON.stringify({ productId: opts.productId }),
  });

  const sign = await signRes.json();
  if (!signRes.ok) throw new Error(sign?.error || "Failed to sign upload");

  const form = new FormData();
  form.append("file", opts.file);
  form.append("api_key", sign.apiKey);
  form.append("timestamp", String(sign.timestamp));
  form.append("folder", sign.folder);
  form.append("signature", sign.signature);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`;
  const upRes = await fetch(uploadUrl, { method: "POST", body: form });
  const data = await upRes.json();

  if (!upRes.ok) throw new Error(data?.error?.message || "Upload failed");

  return {
    imageUrl: data.secure_url as string,
    publicId: data.public_id as string,
    folder: sign.folder as string,
  };
}

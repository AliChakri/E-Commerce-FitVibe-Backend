require('dotenv').config();
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (fileBuffer, fileName) => {
  return await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        public_id: `products/${fileName}`
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    ).end(fileBuffer);
  });
};

//  Extract public_id from a Cloudinary URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split("/");
  const fileWithExt = parts.pop();
  const publicId = fileWithExt.split(".")[0];
  const folder = parts.slice(parts.indexOf("reviews")).join("/");
  return `${folder}/${publicId}`;
};

//  Cleanup unused images
const cleanupCloudinaryImages = async (urls = []) => {
  try {
    for (const url of urls) {
      const publicId = getPublicIdFromUrl(url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }
  } catch (err) {
    console.error("Cloudinary cleanup failed:", err);
  }
};

module.exports = {
  uploadToCloudinary,
  cloudinary,
  getPublicIdFromUrl,
  cleanupCloudinaryImages
};

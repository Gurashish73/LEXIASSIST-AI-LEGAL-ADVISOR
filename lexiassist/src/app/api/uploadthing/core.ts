import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  // Define the route for PDF uploads, max 16MB
  pdfUploader: f({ pdf: { maxFileSize: "16MB", maxFileCount: 1 } })
    .onUploadComplete(async ({ metadata, file }) => {
      // Once uploaded, UploadThing gives us the exact URL database needs
      console.log("Upload complete! File URL:", file.url);
      
      return { fileUrl: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
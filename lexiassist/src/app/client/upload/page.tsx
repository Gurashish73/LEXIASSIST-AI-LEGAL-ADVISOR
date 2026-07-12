"use client";

import { useRouter } from "next/navigation";
import { UploadDropzone } from "@/utils/uploadthing";
import { motion } from "framer-motion";
import Link from "next/link";

export default function UploadFallbackPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full bg-[#08080a] flex items-center justify-center p-4 sm:p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-[#0c0c0e] border border-zinc-800 rounded-3xl p-8 shadow-2xl"
      >
        {/* Header Section */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-medium text-zinc-100 uppercase tracking-wide">Upload Case Document</h1>
            <p className="text-sm font-mono text-zinc-500 mt-2">LexiAssist Secure Intake • PDF format only (Max 16MB)</p>
          </div>
          
          {/* Cancel/Back Button */}
          <Link 
            href="/client"
            className="text-xs font-mono text-zinc-400 hover:text-zinc-200 uppercase tracking-widest px-4 py-2 border border-zinc-800 rounded-lg hover:bg-zinc-800/50 transition-colors"
          >
            Cancel
          </Link>
        </div>

        {/* UploadDropzone Component */}
        <div className="border border-dashed border-zinc-700/50 rounded-2xl bg-zinc-900/30 p-4">
          <UploadDropzone
            endpoint="pdfUploader"
            onClientUploadComplete={(res) => {
              console.log("Files: ", res);
              alert("PDF Uploaded Successfully!");
              
              // On the full page, we push back to the client dashboard instead of using router.back()
              router.push("/client"); 
            }}
            onUploadError={(error: Error) => {
              alert(`ERROR! ${error.message}`);
            }}
            appearance={{
              button: "bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-sm uppercase tracking-widest px-8 py-3 rounded-lg mt-4",
              container: "p-12 focus-within:ring-2 focus-within:ring-emerald-500/50",
              label: "text-zinc-400 hover:text-zinc-300 transition-colors text-lg",
              allowedContent: "text-zinc-600 text-sm font-mono mt-2"
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
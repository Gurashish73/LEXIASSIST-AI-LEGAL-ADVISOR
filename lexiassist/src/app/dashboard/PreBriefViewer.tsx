"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { getCasePreBrief } from "@/app/actions/prebrief";
import { Loader2, AlertOctagon, Target, FileSearch, DollarSign, ShieldAlert, CheckCircle2 } from "lucide-react";

interface PreBriefData {
  caseSummary?: string;
  primaryLegalRisks?: string[];
  statuteOfLimitationsWarning?: boolean;
  estimatedCaseValue?: number;
}

export default function PreBriefViewer({ activeCaseId }: { activeCaseId: string }) {
  const [data, setData] = useState<PreBriefData | null>(null);
  const [dbEstimatedValue, setDbEstimatedValue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPreBrief = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getCasePreBrief(activeCaseId);
      
      if (result.success) {
        let parsedRisk: PreBriefData = {};
        
        if (result.aiRiskAnalysis) {
          if (typeof result.aiRiskAnalysis === 'string') {
            try { parsedRisk = JSON.parse(result.aiRiskAnalysis); } catch (e) {}
          } else {
            parsedRisk = result.aiRiskAnalysis as PreBriefData;
          }
        }
        
        if (!parsedRisk.caseSummary && result.rawDescription) {
          parsedRisk.caseSummary = result.rawDescription;
        }

        setData(parsedRisk);
        setDbEstimatedValue(result.estimatedValue || parsedRisk.estimatedCaseValue || null);
      }
    } catch (error) {
      console.error("Failed to retrieve Pre-Brief matrix:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeCaseId]);

  // Hook 1: Fetch on mount or case switch
  useEffect(() => {
    if (activeCaseId) fetchPreBrief();
  }, [activeCaseId, fetchPreBrief]);

  // Hook 2: Listen for global AI chat completions
  useEffect(() => {
    const handleRefresh = () => {
      fetchPreBrief();
    };
    window.addEventListener('refresh-case-data', handleRefresh);
    return () => window.removeEventListener('refresh-case-data', handleRefresh);
  }, [fetchPreBrief]);

  // 1. Initial Database Fetch Loader
  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center space-y-4 opacity-70">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Compiling Intelligence Brief...</p>
      </div>
    );
  }

  // 2. Safely check if the AI has generated any risk data yet
  const isCompletelyEmpty = !data || (!data.caseSummary && (!data.primaryLegalRisks || data.primaryLegalRisks.length === 0));

  // 3. The Empty State (Replaces the infinite spinner)
  if (isCompletelyEmpty) {
    return (
      <div className="flex-1 p-6 sm:p-8 bg-[#0c0c0e]">
        <div className="flex flex-col h-full w-full items-center justify-center p-8 text-center border border-dashed border-zinc-800/60 rounded-2xl bg-zinc-900/10 mt-4">
          <ShieldAlert className="w-12 h-12 text-zinc-700 mb-4" />
          <h3 className="text-zinc-200 font-medium tracking-wide mb-2">No Risk Assessment Found</h3>
          <p className="text-zinc-500 text-sm max-w-md leading-relaxed">
            The AI Risk Engine has not yet analyzed this narrative. Navigate to the AI Intake Chat and prompt the system to <span className="text-zinc-300 font-mono bg-zinc-900 px-1 rounded">"generate a preliminary risk assessment"</span> to populate this matrix.
          </p>
        </div>
      </div>
    );
  }

  // 4. The Data View
  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800 bg-[#0c0c0e]">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* TOP ROW: Vital Stats & Warnings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 flex flex-col justify-center"
          >
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Estimated Value</h3>
            </div>
            <p className="text-3xl font-light text-zinc-100">
              {dbEstimatedValue ? `$${dbEstimatedValue.toLocaleString()}` : <span className="text-zinc-600">Pending</span>}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={`p-6 rounded-2xl border flex flex-col justify-center md:col-span-2 ${
              data?.statuteOfLimitationsWarning 
                ? "border-rose-900/50 bg-rose-950/20" 
                : "border-emerald-900/30 bg-emerald-950/10"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {data?.statuteOfLimitationsWarning ? (
                <AlertOctagon className="w-4 h-4 text-rose-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              )}
              <h3 className={`text-[10px] font-mono uppercase tracking-widest font-bold ${
                data?.statuteOfLimitationsWarning ? "text-rose-500" : "text-emerald-500"
              }`}>
                Statute of Limitations Status
              </h3>
            </div>
            <p className={`text-sm leading-relaxed ${data?.statuteOfLimitationsWarning ? "text-rose-200" : "text-emerald-200"}`}>
              {data?.statuteOfLimitationsWarning 
                ? "CRITICAL WARNING: The chronological events indicate a rapidly approaching filing deadline. Immediate attorney intervention is highly recommended." 
                : "No immediate statutory filing deadlines or expiration dates were flagged in the preliminary review."}
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-2 mb-4">
              <FileSearch className="w-4 h-4 text-blue-400" />
              <h3 className="text-[10px] font-mono text-blue-400 uppercase tracking-widest font-bold">
                Objective Case Summary
              </h3>
            </div>
            <div className="p-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 h-[calc(100%-2rem)]">
              <p className="text-sm text-zinc-300 leading-relaxed">
                {data?.caseSummary || "No summary was generated for this narrative."}
              </p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-amber-500" />
              <h3 className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-bold">
                Primary Legal Risks
              </h3>
            </div>
            <div className="p-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 h-[calc(100%-2rem)]">
              {data?.primaryLegalRisks && data.primaryLegalRisks.length > 0 ? (
                <ul className="space-y-4">
                  {data.primaryLegalRisks.map((risk, idx) => (
                    <li key={idx} className="flex gap-3">
                      <ShieldAlert className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
                      <p className="text-sm text-zinc-300 leading-relaxed">{risk}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-60">
                  <ShieldAlert className="w-8 h-8 mb-2" />
                  <p className="text-xs font-mono uppercase tracking-widest">No Primary Risks Flagged</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
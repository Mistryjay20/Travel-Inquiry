import React, { useState } from 'react';
import { Modal } from '../components/Modal.tsx';
import { DispatchRecord, Inquiry } from '../types/index.ts';
import { ApiClient } from '../api/client.ts';
import { CheckCircle2, XCircle, Clock, RotateCw, Eye } from 'lucide-react';

interface SendStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  inquiry: Inquiry | null;
  onDispatchUpdated?: (updatedInquiry: Inquiry) => void;
}

export const SendStatusModal: React.FC<SendStatusModalProps> = ({
  isOpen,
  onClose,
  inquiry,
  onDispatchUpdated,
}) => {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);

  if (!inquiry) return null;

  const handleRetry = async (dispatchId: string) => {
    setRetryingId(dispatchId);
    try {
      const res = await ApiClient.retryDispatch(inquiry.id, dispatchId);
      if (onDispatchUpdated) {
        onDispatchUpdated(res.inquiry);
      }
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const openPreview = (dispatch: DispatchRecord) => {
    setPreviewHtml(dispatch.previewHtml);
    setPreviewSubject(dispatch.subject);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Dispatch Status · Inquiry #${inquiry.inquiryNumber}`}
      >
        <div className="space-y-4">
          {/* Header summary */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-xs font-semibold text-slate-900">{inquiry.destination}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Client: {inquiry.clientName} · Dispatched to {inquiry.dispatches.length} agent(s)
            </div>
          </div>

          {/* Dispatch records list */}
          <div className="space-y-2.5">
            {inquiry.dispatches.map((d) => (
              <div
                key={d.id}
                className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{d.agentName}</div>
                    <div className="text-xs text-slate-500">{d.agentEmail}</div>
                  </div>

                  {/* Status Indicator */}
                  <div className="shrink-0">
                    {d.status === 'sent' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Sent
                      </span>
                    )}

                    {d.status === 'test_preview' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Test Preview
                      </span>
                    )}

                    {d.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Failed
                      </span>
                    )}
                  </div>
                </div>

                {d.errorText && (
                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                    {d.errorText}
                  </div>
                )}

                {/* Actions row */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <button
                    onClick={() => openPreview(d)}
                    className="min-h-[44px] flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Email HTML</span>
                  </button>

                  {d.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(d.id)}
                      disabled={retryingId === d.id}
                      className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${retryingId === d.id ? 'animate-spin' : ''}`} />
                      <span>{retryingId === d.id ? 'Retrying...' : 'Retry'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Email Preview Modal */}
      {previewHtml && (
        <Modal
          isOpen={Boolean(previewHtml)}
          onClose={() => setPreviewHtml(null)}
          title={`Email Preview · ${previewSubject || 'Quotation Request'}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-3">
            <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <strong>Notice:</strong> This email was built on the server. Notice that <strong>Client Phone is NEVER present</strong> in this email to protect your client relationship.
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 p-2 max-h-[60vh] overflow-y-auto">
              <iframe
                title="Email Preview"
                srcDoc={previewHtml}
                className="w-full h-[480px] bg-white rounded-lg border-0"
                sandbox="allow-same-origin"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setPreviewHtml(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

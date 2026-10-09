import { useCallback, useEffect, useRef, useState } from 'react';
import { LifeBuoy, Loader2, MessageSquarePlus, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SupportMessage, SupportTicket } from '../lib/types';

const TICKET_STATUS: Record<SupportTicket['status'], { label: string; cls: string }> = {
  open: { label: 'Aberto', cls: 'bg-sky-100 text-sky-700' },
  answered: { label: 'Respondido', cls: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Fechado', cls: 'bg-slate-100 text-slate-500' },
};

export default function SupportTab({ tenantId }: { tenantId: string }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [firstMsg, setFirstMsg] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadTickets = useCallback(async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    setTickets(data ?? []);
    setLoading(false);
  }, [tenantId]);

  const loadMessages = useCallback(async (ticketId: string) => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at');
    setMessages(data ?? []);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (openId) loadMessages(openId);
  }, [openId, loadMessages]);

  async function createTicket() {
    if (!subject.trim() || !firstMsg.trim() || busy) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({ tenant_id: tenantId, subject: subject.trim(), status: 'open' })
      .select()
      .single();
    if (!error && data) {
      await supabase
        .from('support_messages')
        .insert({ ticket_id: data.id, author_role: 'client', body: firstMsg.trim() });
      setSubject('');
      setFirstMsg('');
      setCreating(false);
      await loadTickets();
      setOpenId(data.id);
    }
    setBusy(false);
  }

  async function sendReply() {
    if (!openId || !reply.trim() || busy) return;
    setBusy(true);
    await supabase
      .from('support_messages')
      .insert({ ticket_id: openId, author_role: 'client', body: reply.trim() });
    await supabase
      .from('support_tickets')
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('id', openId);
    setReply('');
    await loadMessages(openId);
    await loadTickets();
    setBusy(false);
  }

  const open = tickets.find((t) => t.id === openId) ?? null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <LifeBuoy size={18} className="brand-text" /> Suporte técnico
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Fale com a equipe do KalBix sobre qualquer problema ou dúvida.</p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-accent text-xs px-3 py-2 flex items-center gap-1.5">
            <MessageSquarePlus size={14} /> Novo chamado
          </button>
        )}
      </div>

      {creating && (
        <div className="card p-4 mb-4 space-y-3">
          <input
            className="input"
            placeholder="Assunto (ex.: Não consigo salvar horários)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="input min-h-[90px]"
            placeholder="Descreva o problema com detalhes…"
            value={firstMsg}
            onChange={(e) => setFirstMsg(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(false)} className="btn-ghost text-xs px-3 py-2">Cancelar</button>
            <button
              onClick={createTicket}
              disabled={busy || !subject.trim() || !firstMsg.trim()}
              className="btn-accent text-xs px-4 py-2 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">
          <Loader2 className="animate-spin mx-auto" /> Carregando…
        </div>
      ) : open ? (
        <div className="card p-4">
          <button onClick={() => setOpenId(null)} className="btn-ghost text-xs px-3 py-1.5 mb-3">
            ← Voltar aos chamados
          </button>
          <div className="flex items-center gap-2 mb-3">
            <p className="font-bold flex-1 truncate">{open.subject}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TICKET_STATUS[open.status].cls}`}>
              {TICKET_STATUS[open.status].label}
            </span>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto mb-3 pr-1">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.author_role === 'client' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                    m.author_role === 'client'
                      ? 'brand-accent text-slate-900 rounded-br-sm'
                      : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                  }`}
                >
                  {m.author_role === 'admin' && (
                    <p className="text-[10px] font-bold text-slate-500 mb-0.5">Equipe KalBix</p>
                  )}
                  {m.body}
                  <p className="text-[10px] opacity-60 mt-1">
                    {new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {open.status !== 'closed' && (
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Escreva uma mensagem…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendReply()}
              />
              <button onClick={sendReply} disabled={busy || !reply.trim()} className="btn-accent px-4 disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          )}
        </div>
      ) : tickets.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Nenhum chamado ainda. Abra um chamado quando precisar de ajuda.
        </div>
      ) : (
        <div className="grid gap-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className="card p-3.5 text-left hover:border-slate-400 transition flex items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{t.subject}</p>
                <p className="text-[11px] text-slate-400">
                  Atualizado em {new Date(t.updated_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TICKET_STATUS[t.status].cls}`}>
                {TICKET_STATUS[t.status].label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

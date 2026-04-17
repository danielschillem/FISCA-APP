import { useState, useRef, useEffect } from 'react';
import { assistantApi } from '../lib/api';
import { Btn } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { Bot } from 'lucide-react';

// ── Markdown renderer (sans dépendance externe) ──────────────────────────────
function renderInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        if (m[1] !== undefined) parts.push(<strong key={m.index} className="font-semibold text-gray-900">{m[1]}</strong>);
        else if (m[2] !== undefined) parts.push(<em key={m.index} className="italic">{m[2]}</em>);
        last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
}

function MarkdownMsg({ content }: { content: string }) {
    const lines = content.split('\n');
    const nodes: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = (key: string) => {
        if (listItems.length === 0) return;
        nodes.push(
            <ul key={key} className="my-1.5 space-y-0.5 pl-1">
                {listItems.map((item, i) => (
                    <li key={i} className="flex gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        <span>{renderInline(item)}</span>
                    </li>
                ))}
            </ul>
        );
        listItems = [];
    };

    lines.forEach((raw, idx) => {
        const line = raw.trimEnd();
        if (/^[-•]\s+/.test(line)) {
            listItems.push(line.replace(/^[-•]\s+/, ''));
            return;
        }
        flushList(`list-${idx}`);
        if (line === '') {
            nodes.push(<div key={`br-${idx}`} className="h-2" />);
        } else {
            nodes.push(
                <p key={idx} className="leading-relaxed">{renderInline(line)}</p>
            );
        }
    });
    flushList('list-end');

    return <div className="space-y-0.5 text-sm text-gray-800">{nodes}</div>;
}

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
    'Comment calculer l\'IUTS pour un cadre en 2025 ?',
    'Quelles sont les tranches d\'imposition CGI 2025 ?',
    'Comment déclarer la TVA au Burkina Faso ?',
    'Quelle est la différence entre CNSS et CARFO ?',
    'Expliquez l\'abattement forfaitaire non-cadre',
    'Comment calculer la patente professionnelle ?',
];

export default function AssistantPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('assistant')) return <Locked />;
    return <AssistantContent />;
}

function AssistantContent() {
    const [msgs, setMsgs] = useState<Msg[]>([
        { role: 'assistant', content: 'Bonjour ! Je suis votre assistant fiscal FISCA, spécialisé dans le Code Général des Impôts du Burkina Faso 2025. Comment puis-je vous aider ?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [msgs]);

    const send = async (text: string) => {
        if (!text.trim() || loading) return;
        const userMsg: Msg = { role: 'user', content: text };
        setMsgs((m) => [...m, userMsg]);
        setInput('');
        setLoading(true);
        try {
            const r = await assistantApi.chat(text);
            setMsgs((m) => [...m, { role: 'assistant', content: r.data.reply ?? r.data.response ?? '' }]);
        } catch {
            setMsgs((m) => [...m, { role: 'assistant', content: 'Désolé, une erreur est survenue. Veuillez réessayer.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {msgs.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 mt-0.5"
                                style={{ background: '#24a05a' }}>
                                F
                            </div>
                        )}
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user'
                                ? 'bg-green-600 text-white rounded-br-sm whitespace-pre-wrap'
                                : 'bg-white border border-gray-200 rounded-bl-sm shadow-sm'
                                }`}
                        >
                            {m.role === 'user' ? m.content : <MarkdownMsg content={m.content} />}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex items-center gap-2 text-gray-400">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: '#24a05a' }}>F</div>
                        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            {msgs.length <= 1 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s}
                            onClick={() => send(s)}
                            className="text-xs bg-gray-100 hover:bg-green-50 text-gray-700 hover:text-green-700 px-3 py-1.5 rounded-full border border-gray-200 transition-colors"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="flex gap-2 mt-auto">
                <input
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="Posez votre question fiscale…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    disabled={loading}
                />
                <Btn onClick={() => send(input)} disabled={!input.trim() || loading}>
                    Envoyer
                </Btn>
            </div>
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Bot className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Assistant IA <span className="text-green-600">Pro</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Pro pour accéder à l'assistant fiscal IA.</p>
            </div>
        </div>
    );
}


'use client'
import { useState, useRef, useEffect } from 'react'
import { assistantApi } from '@/lib/api'
import { Bot, Send, User, Loader2 } from 'lucide-react'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

const EXAMPLES = [
    'Quel est le taux d\'IUTS pour un salaire de 200 000 F CFA ?',
    'Comment calculer la TPA pour un employé cadre ?',
    'Quelle est la différence entre CNSS et CARFO ?',
    'Quand déposer la déclaration mensuelle IUTS ?',
]

export default function AssistantPage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: 'Bonjour ! Je suis votre assistant fiscal FISCA. Je peux vous aider sur la fiscalité du Burkina Faso (IUTS, TPA, CNSS/CARFO, déclarations DGI-BF). Posez-moi vos questions.',
        },
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    async function sendMessage(text: string) {
        const userMsg = text.trim()
        if (!userMsg || loading) return
        setInput('')
        setMessages(m => [...m, { role: 'user', content: userMsg }])
        setLoading(true)
        try {
            const res = await assistantApi.chat(userMsg)
            const reply: string = res.data?.reply ?? res.data?.message ?? '(Pas de réponse)'
            setMessages(m => [...m, { role: 'assistant', content: reply }])
        } catch {
            setMessages(m => [...m, {
                role: 'assistant',
                content: 'Désolé, une erreur s\'est produite. Vérifiez votre connexion ou contactez le support.',
            }])
        } finally {
            setLoading(false)
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage(input)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', maxWidth: 800, margin: '0 auto' }}>
            {/* Messages */}
            <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginBottom: 12 }}>
                <div className="card-header">
                    <h3><Bot size={15} style={{ marginRight: 6 }} />Assistant fiscal FISCA</h3>
                    <span className="ch-right" style={{ fontSize: 11, color: 'var(--gr5)' }}>Burkina Faso · LF 2020</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {messages.map((m, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            gap: 10,
                            marginBottom: 16,
                            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                        }}>
                            {/* Avatar */}
                            <div style={{
                                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                                background: m.role === 'assistant' ? 'var(--prime)' : 'var(--gr3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {m.role === 'assistant'
                                    ? <Bot size={14} color="white" />
                                    : <User size={14} color="white" />
                                }
                            </div>
                            {/* Bulle */}
                            <div style={{
                                maxWidth: '80%',
                                background: m.role === 'assistant' ? 'var(--gr1)' : 'var(--prime)',
                                color: m.role === 'assistant' ? 'var(--gr9)' : 'white',
                                borderRadius: m.role === 'assistant' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                                padding: '10px 14px',
                                fontSize: 13,
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                            }}>
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                            <div style={{
                                width: 30, height: 30, borderRadius: '50%',
                                background: 'var(--prime)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Bot size={14} color="white" />
                            </div>
                            <div style={{
                                background: 'var(--gr1)', borderRadius: '4px 12px 12px 12px',
                                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--prime)' }} />
                                <span style={{ fontSize: 13, color: 'var(--gr5)' }}>Rédaction en cours…</span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Exemples de questions */}
            {messages.length === 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {EXAMPLES.map((ex) => (
                        <button
                            key={ex}
                            className="btn btn-outline btn-sm"
                            onClick={() => sendMessage(ex)}
                            style={{ fontSize: 12 }}
                        >
                            {ex}
                        </button>
                    ))}
                </div>
            )}

            {/* Zone de saisie */}
            <div className="card" style={{ padding: 12, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <textarea
                        rows={2}
                        placeholder="Posez votre question fiscale… (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{
                            flex: 1, resize: 'none', border: '1px solid var(--gr2)',
                            borderRadius: 8, padding: '8px 12px', fontSize: 13,
                            fontFamily: 'inherit', outline: 'none',
                            lineHeight: 1.5,
                        }}
                        disabled={loading}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={() => sendMessage(input)}
                        disabled={loading || !input.trim()}
                        style={{ flexShrink: 0, alignSelf: 'flex-end' }}
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    )
}

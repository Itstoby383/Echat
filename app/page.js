'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 1200;

export default function Home() {
  const [stage, setStage] = useState('idle'); // idle | searching | chatting | ended
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [online, setOnline] = useState(0);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const userId = useRef(null);
  const room = useRef({ roomId: null, partnerId: null, cursor: 0 });
  const stageRef = useRef(stage);
  const timer = useRef(null);
  const logRef = useRef(null);
  const lastTyping = useRef(0);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    let id = sessionStorage.getItem('echat:id');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)) + '';
      sessionStorage.setItem('echat:id', id);
    }
    userId.current = id;

    const bye = () => {
      const body = JSON.stringify({
        userId: userId.current,
        roomId: room.current.roomId,
        partnerId: room.current.partnerId,
        quit: true,
      });
      navigator.sendBeacon?.('/api/leave', new Blob([body], { type: 'application/json' }));
    };
    window.addEventListener('beforeunload', bye);
    return () => {
      window.removeEventListener('beforeunload', bye);
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, partnerTyping]);

  const addSystem = (text) => {
    setMessages((m) => [...m, { kind: 'system', text, ts: Date.now() }]);
  };

  const schedule = useCallback((fn) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, POLL_MS);
  }, []);

  const poll = useCallback(
    async () => {
      if (!userId.current) return;
      const { roomId, partnerId, cursor } = room.current;
      const qs = new URLSearchParams({ userId: userId.current, cursor: String(cursor) });
      if (roomId) qs.set('roomId', roomId);
      if (partnerId) qs.set('partnerId', partnerId);

      try {
        const res = await fetch(`/api/poll?${qs.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (typeof data.online === 'number') setOnline(data.online);

        if (data.status === 'matched') {
          room.current = { roomId: data.roomId, partnerId: data.partnerId, cursor: 0 };
          setStage('chatting');
          addSystem('You are now chatting with a stranger. Say hi.');
        } else if (data.status === 'chatting' || data.status === 'ended') {
          if (data.messages?.length) {
            room.current.cursor = data.cursor;
            setMessages((m) => [
              ...m,
              ...data.messages.map((msg) => ({
                kind: msg.from === userId.current ? 'you' : 'them',
                text: msg.text,
                ts: msg.ts,
              })),
            ]);
          }
          setPartnerTyping(Boolean(data.partnerTyping));
          if (data.status === 'ended' && stageRef.current === 'chatting') {
            setStage('ended');
            setPartnerTyping(false);
            addSystem('The stranger has left. Start a new chat whenever you like.');
            return;
          }
        }
      } catch {
        // Network hiccup — just try again on the next tick.
      }

      if (stageRef.current === 'searching' || stageRef.current === 'chatting') {
        schedule(poll);
      }
    },
    [schedule]
  );

  const start = useCallback(async () => {
    clearTimeout(timer.current);
    setMessages([]);
    setPartnerTyping(false);
    room.current = { roomId: null, partnerId: null, cursor: 0 };
    setStage('searching');

    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.current }),
      });
      const data = await res.json();
      if (typeof data.online === 'number') setOnline(data.online);

      if (data.status === 'matched') {
        room.current = { roomId: data.roomId, partnerId: data.partnerId, cursor: 0 };
        setStage('chatting');
        addSystem('You are now chatting with a stranger. Say hi.');
      }
    } catch {
      setStage('idle');
      return;
    }
    schedule(poll);
  }, [poll, schedule]);

  const leave = useCallback(
    async (next) => {
      clearTimeout(timer.current);
      const { roomId, partnerId } = room.current;
      const payload = { userId: userId.current, roomId, partnerId };
      room.current = { roomId: null, partnerId: null, cursor: 0 };
      setPartnerTyping(false);
      setStage(next === 'new' ? 'idle' : 'ended');
      if (next !== 'new') addSystem('You left the chat.');

      try {
        await fetch('/api/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {}

      if (next === 'new') start();
    },
    [start]
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !room.current.roomId) return;
    setDraft('');
    try {
      await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.current, roomId: room.current.roomId, text }),
      });
    } catch {}
    poll();
  }, [draft, poll]);

  const onDraft = (e) => {
    setDraft(e.target.value);
    const now = Date.now();
    if (room.current.roomId && now - lastTyping.current > 2500) {
      lastTyping.current = now;
      fetch('/api/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.current, roomId: room.current.roomId }),
      }).catch(() => {});
    }
  };

  const chatting = stage === 'chatting';
  const live = chatting || stage === 'ended';

  return (
    <main className="shell">
      <header className="top">
        <h1 className="mark">
          Echat<span>.</span>
        </h1>
        <div className="presence">
          <i className="dot" aria-hidden="true" />
          <span>
            <b>{online}</b> people here right now
          </span>
        </div>
      </header>

      <section className="panel">
        {stage === 'idle' && (
          <div className="stage">
            <h2>Meet someone you don&rsquo;t know</h2>
            <p>
              Echat pairs you with one random person for a text conversation. No accounts, no
              profiles, no history. Leave whenever you want and you&rsquo;ll get someone new.
            </p>
            <button className="start" onClick={start}>
              Start chatting
            </button>
            <p className="rules">
              Be decent. Don&rsquo;t share your address, passwords or bank details, and
              don&rsquo;t use Echat if you&rsquo;re under 18.
            </p>
          </div>
        )}

        {stage === 'searching' && (
          <div className="stage">
            <div className="ping">
              <i />
            </div>
            <h2>Looking for a stranger</h2>
            <p>Hang tight. You&rsquo;ll be connected as soon as someone else is free.</p>
            <button className="ghost" onClick={() => leave('stop')}>
              Cancel
            </button>
          </div>
        )}

        {live && (
          <>
            <div className="log" ref={logRef}>
              {messages.map((m, i) =>
                m.kind === 'system' ? (
                  <div key={i} className="system">
                    {m.text}
                  </div>
                ) : (
                  <div key={i} className={`bubble ${m.kind}`}>
                    {m.text}
                  </div>
                )
              )}
              {partnerTyping && <div className="typing">Stranger is typing…</div>}
            </div>

            <div className="composer">
              <input
                value={draft}
                onChange={onDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send();
                }}
                placeholder={chatting ? 'Type a message and press Enter' : 'This chat has ended'}
                disabled={!chatting}
                maxLength={1000}
                autoFocus
              />
              <button className="send" onClick={send} disabled={!chatting || !draft.trim()}>
                Send
              </button>
              <button className="ghost" onClick={() => leave(chatting ? 'stop' : 'new')}>
                {chatting ? 'Leave' : 'New chat'}
              </button>
            </div>
          </>
        )}
      </section>

      <p className="foot">Echat · anonymous, unsaved, one stranger at a time</p>
    </main>
  );
}

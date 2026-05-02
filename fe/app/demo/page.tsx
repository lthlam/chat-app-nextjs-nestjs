'use client';

import { useMemo, useState } from 'react';
import { Bell, Heart, MessageCircle, Sparkles, Star } from 'lucide-react';

const palette = ['#f5f0ff', '#ede4ff', '#dccbff', '#c5a6ff', '#ab7dff'];

export default function CuteUiDemoPage() {
  const [liked, setLiked] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'cards' | 'buttons'>('chat');

  const gradient = useMemo(
    () => `linear-gradient(135deg, ${palette[0]} 0%, ${palette[2]} 45%, ${palette[4]} 100%)`,
    [],
  );

  return (
    <main className="min-h-screen p-6 md:p-10" style={{ background: gradient }}>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border-4 border-white/80 bg-white/85 p-6 shadow-[0_18px_45px_-20px_rgba(67,24,122,0.45)] backdrop-blur-sm md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                <Sparkles className="h-3.5 w-3.5" />
                Demo UI Hoat Hinh
              </p>
              <h1 className="mt-3 text-3xl font-extrabold text-blue-700 md:text-4xl">
                Ban xem thu giao dien ngo nghinh
              </h1>
              <p className="mt-2 text-sm text-gray-600 md:text-base">
                Mau pastel, bo goc lon, bong do mem va nhan nhay nhe de tao cam giac vui mat.
              </p>
            </div>
            <button
              onClick={() => setLiked((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-2xl border-2 px-4 py-2 font-semibold transition ${
                liked
                  ? 'border-pink-300 bg-pink-100 text-pink-700'
                  : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
              }`}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-pink-500 text-pink-500' : ''}`} />
              {liked ? 'Da thich style nay' : 'Thu bam tim'}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border-4 border-white/80 bg-white/90 p-4 shadow-[0_18px_45px_-20px_rgba(67,24,122,0.45)] md:p-6">
          <div className="mb-4 inline-flex rounded-2xl bg-blue-50 p-1">
            {(['chat', 'cards', 'buttons'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab
                    ? 'bg-white text-blue-700 shadow'
                    : 'text-blue-500 hover:bg-white/70'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {activeTab === 'chat' && (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <aside className="rounded-2xl border-2 border-blue-100 bg-blue-50/80 p-3">
                <h3 className="mb-3 text-sm font-bold text-blue-700">Danh sach chat</h3>
                {['Nhom thiet ke', 'Ban than', 'Do an cuoi tuan'].map((name, idx) => (
                  <button
                    key={name}
                    className={`mb-2 flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                      idx === 0
                        ? 'border-blue-300 bg-white text-blue-800'
                        : 'border-transparent bg-white/70 text-gray-700 hover:border-blue-200'
                    }`}
                  >
                    <div className="h-9 w-9 rounded-full bg-blue-200" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="truncate text-xs text-gray-500">Tin nhắn mới nhất…</p>
                    </div>
                    {idx === 0 && <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />}
                  </button>
                ))}
              </aside>

              <div className="rounded-2xl border-2 border-blue-100 bg-white p-4">
                <div className="mb-4 flex items-center justify-between border-b border-blue-100 pb-3">
                  <p className="font-bold text-blue-700">Nhom thiet ke</p>
                  <button className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    <Bell className="h-3.5 w-3.5" /> Thong bao
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="max-w-xs rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-sm text-gray-700">
                    Chao ca nha, xem ban demo nay nhe.
                  </div>
                  <div className="ml-auto max-w-xs rounded-2xl rounded-br-sm bg-blue-500 px-4 py-2 text-sm text-white">
                    Mau tim pastel nhin rat de thuong.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cards' && (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { title: 'Sticker Card', text: 'Card bo goc lon, bong do mem.' },
                { title: 'Cute Badge', text: 'Badge tron nho, mau pastel.' },
                { title: 'Playful Shadow', text: 'Vien day + shadow de tao style cartoon.' },
              ].map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-white to-blue-50 p-4 shadow-[0_10px_25px_-16px_rgba(67,24,122,0.6)]"
                >
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white">
                    <Star className="h-4 w-4" />
                  </div>
                  <h4 className="font-bold text-blue-700">{item.title}</h4>
                  <p className="mt-1 text-sm text-gray-600">{item.text}</p>
                </article>
              ))}
            </div>
          )}

          {activeTab === 'buttons' && (
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-2xl border-2 border-blue-300 bg-blue-500 px-5 py-2.5 font-semibold text-white shadow hover:bg-blue-600">
                Primary
              </button>
              <button className="rounded-2xl border-2 border-blue-200 bg-blue-100 px-5 py-2.5 font-semibold text-blue-700 hover:bg-blue-200">
                Soft
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl border-2 border-gray-200 bg-white px-5 py-2.5 font-semibold text-gray-700 hover:border-blue-300 hover:text-blue-700">
                <MessageCircle className="h-4 w-4" /> Bubble Action
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


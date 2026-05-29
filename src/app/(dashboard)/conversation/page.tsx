"use client"

import { useState, useEffect, Fragment } from 'react';
import {
  Search, PlusCircle, Bell, Filter, Edit, MessageCircle,
  ArrowLeft, CheckCircle, CornerUpRight, MoreVertical,
  CheckCheck, Plus, Send, Loader2
} from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string | number;
  text: string;
  sender: 'user' | 'agent';
  time: string;
}

interface Chat {
  id: string | number;
  name: string;
  platform: string;
  igsid: string;
  status: string;
  messages: Message[];
}

export default function Conversation() {
  const [mobileView, setMobileView] = useState<'inbox' | 'chat' | 'details'>('inbox');
  const [desktopPane, setDesktopPane] = useState<'inbox' | 'details'>('inbox');
  const [activeTab, setActiveTab] = useState('All');

  // DYNAMIC STATES
  const [activeChatId, setActiveChatId] = useState<string | number>(1);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  const tabs = ['All', 'Instagram', 'Facebook'];

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchChatsAndMessages = async () => {
    setIsFetching(true);
    setTimeout(() => {
      const dummyChats: Chat[] = [
        {
          id: 1, name: 'testingname1', platform: 'instagram', igsid: '123456789', status: 'Online',
          messages: [
            { id: 1, text: 'Hello, I want to inquire about solar panels', sender: 'user', time: '10:00 AM' },
            { id: 2, text: 'Sure! I can help you with that.', sender: 'agent', time: '10:05 AM' }
          ]
        },
        {
          id: 2, name: 'testingname2', platform: 'facebook', igsid: '987654321', status: 'Offline',
          messages: [
            { id: 1, text: 'Do you offer installation in Chennai?', sender: 'user', time: '09:00 AM' }
          ]
        }
      ];
      setChats(dummyChats);
      setActiveChatId(1);
      setIsFetching(false);
    }, 500);
  };

  useEffect(() => {
    fetchChatsAndMessages();
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setTimeout(() => {
      setChats(prev => prev.map(c => {
        if (c.id === activeChatId) {
          return { 
            ...c, 
            messages: [
              ...c.messages, 
              { 
                id: Date.now(), 
                text: inputText, 
                sender: 'agent', 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
              }
            ] 
          };
        }
        return c;
      }));
      setInputText("");
      setIsLoading(false);
    }, 300);
  };

  const handleChatSelect = (id: string | number) => {
    setActiveChatId(id);
    if (window.innerWidth <= 1024) setMobileView('chat');
  };

  const toggleDetails = () => {
    if (window.innerWidth <= 1024) setMobileView('details');
    else setDesktopPane(prev => prev === 'details' ? 'inbox' : 'details');
  };

  const activeChat = chats.find(chat => chat.id === activeChatId);

  // Pane Visibilities
  const inboxVisible = isMobile ? mobileView === 'inbox' : true;
  const chatVisible = isMobile ? mobileView === 'chat' : true;
  const detailsVisible = isMobile ? mobileView === 'details' : desktopPane === 'details';

  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <header className="flex items-center justify-between h-[72px] px-6 bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shrink-0 max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-[#f9f8fc] border border-[#e5e4e7] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} />
          <input type="text" placeholder="Search conversations..." className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text" />
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-gradient-to-r from-red-500 to-red-600 text-white border-none p-2 px-4 rounded-lg text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-md">
            <PlusCircle size={16} /> Quick Add
          </button>
          <Link href="/remainder" className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
            <Bell size={20} className="text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-brand-red rounded-full border-2 border-white"></span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden bg-white h-[calc(100vh-72px)]">
        {/* Inbox panel */}
        <section className={`${inboxVisible ? 'flex' : 'hidden'} w-[340px] max-[1024px]:w-full flex-col shrink-0 border-r border-[#f0f0f0] bg-white`}>
          <div className="flex justify-between items-center px-6 py-5 pb-2.5">
            <h2 className="text-xl font-extrabold text-gray-900 m-0">Inbox</h2>
            <div className="flex gap-2">
              <button className="bg-transparent border-none cursor-pointer text-gray-500 hover:text-gray-700"><Filter size={18} /></button>
              <button className="bg-transparent border-none cursor-pointer text-gray-500 hover:text-gray-700"><Edit size={18} /></button>
            </div>
          </div>

          <div className="flex gap-5 px-6 border-b border-[#f0f0f0] overflow-x-auto select-none">
            {tabs.map(tab => (
              <button
                key={tab}
                className={`bg-transparent border-none py-2.5 px-0 text-sm font-semibold cursor-pointer border-b-2 transition-all ${
                  activeTab === tab ? 'text-brand-red border-brand-red' : 'text-gray-500 border-transparent'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isFetching ? (
              <div className="p-6 text-center text-gray-500 text-sm">Loading chats...</div>
            ) : chats.filter(chat => activeTab === 'All' || chat.platform.toLowerCase() === activeTab.toLowerCase()).map(chat => (
              <div
                key={chat.id}
                className={`flex gap-3.5 p-4 px-6 border-b border-[#f9fafb] cursor-pointer transition-colors border-l-4 ${
                  activeChatId === chat.id 
                    ? 'bg-[#fff5f5] border-brand-red' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
                onClick={() => handleChatSelect(chat.id)}
              >
                <div className="relative w-11 h-11 shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 uppercase">{chat.name.charAt(0)}</div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white text-[8px] ${
                    chat.platform === 'whatsapp' ? 'bg-[#25d366]' : chat.platform === 'messenger' ? 'bg-[#0084ff]' : 'bg-[#e1306c]'
                  }`}>
                    <MessageCircle size={10} color="white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="m-0 text-sm font-semibold text-gray-900 truncate">{chat.name}</h4>
                    <span className="text-[11px] text-gray-400">
                      {chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].time : ''}
                    </span>
                  </div>
                  <p className="m-0 text-xs text-gray-500 truncate">{chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text : 'No messages yet'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Chat panel */}
        {activeChat ? (
          <section className={`${chatVisible ? 'flex' : 'hidden'} flex-1 flex-col bg-[#fafafa] min-w-0`}>
            <div className="h-[72px] bg-white border-b border-[#f0f0f0] flex justify-between items-center px-6">
              <div className="flex items-center gap-3">
                <button className="bg-transparent border-none cursor-pointer text-gray-700 p-1 mr-2 hidden max-[1024px]:block" onClick={() => setMobileView('inbox')}>
                  <ArrowLeft size={20} />
                </button>

                <div className="flex items-center gap-3 cursor-pointer p-1.5 rounded-lg hover:bg-gray-100 transition-colors" onClick={toggleDetails}>
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 shrink-0 uppercase">{activeChat.name.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="m-0 text-sm font-bold text-gray-900">{activeChat.name}</h4>
                      <span className={`w-2 h-2 rounded-full ${activeChat.status === 'Online' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                    </div>
                    <span className="text-xs text-gray-500">{activeChat.platform.charAt(0).toUpperCase() + activeChat.platform.slice(1)} • {activeChat.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button className="bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer max-[768px]:hidden"><CheckCircle size={16} /> Mark as Closed</button>
                <Link href={`/leads?autofillName=${activeChat.name}&autofillPlatform=${activeChat.platform}`} className="bg-gradient-to-r from-red-500 to-red-600 hover:opacity-95 text-white py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer max-[768px]:hidden shadow-sm"><CornerUpRight size={16} /> Convert to Lead</Link>
                <button className="bg-transparent border-none text-gray-500 hover:text-gray-700 cursor-pointer flex p-1"><MoreVertical size={20} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
              <div className="text-center my-4">
                <span className="bg-white px-3 py-1 rounded-full text-[11px] font-bold text-gray-400 shadow-sm border border-gray-100">TODAY</span>
              </div>

              {activeChat.messages.map(msg => (
                <Fragment key={msg.id}>
                  <div className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'self-start' : 'self-end'}`}>
                    <div className={`p-3.5 px-4 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user' 
                        ? 'bg-white text-gray-800 border border-[#f0f0f0] rounded-bl-none shadow-sm' 
                        : 'bg-brand-red text-white rounded-br-none shadow-[0_2px_8px_rgba(211,47,47,0.2)]'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                  <span className={`text-[10px] text-gray-400 mt-[-6px] flex items-center gap-1 ${msg.sender === 'user' ? 'self-start ml-1' : 'self-end mr-1'}`}>
                    {msg.time} {msg.sender === 'agent' && <CheckCheck size={14} className="text-brand-red font-bold" />}
                  </span>
                </Fragment>
              ))}
            </div>

            <div className="bg-white p-4 px-6 border-t border-[#f0f0f0]">
              <div className="flex items-center gap-3 border border-gray-300 p-2 rounded-lg bg-white">
                <button className="bg-transparent border-none cursor-pointer text-gray-500 hover:text-gray-750 flex p-1">
                  <Plus size={20} />
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isLoading}
                  className="flex-1 border-none outline-none text-sm text-brand-text bg-transparent"
                />
                <button 
                  onClick={handleSendMessage} 
                  disabled={isLoading}
                  className="bg-brand-red hover:bg-brand-red-hover text-white border-none w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className={`${chatVisible ? 'flex' : 'hidden'} flex-1 items-center justify-center text-gray-400 text-sm`}>
            {isFetching ? 'Loading conversation...' : 'Select a conversation to start chatting'}
          </section>
        )}

        {/* Details panel */}
        {activeChat && (
          <aside className={`${detailsVisible ? 'flex' : 'hidden'} w-[320px] max-[1024px]:w-full flex-col shrink-0 border-l border-[#f0f0f0] bg-white overflow-y-auto p-6`}>
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-6 flex items-center gap-2.5">
              <button className="bg-transparent border-none cursor-pointer text-gray-700 p-1 mr-1 hidden max-[1024px]:block" onClick={() => setMobileView('chat')}>
                <ArrowLeft size={20} />
              </button>
              Details
            </h3>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-center mb-6 shadow-sm">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 text-xl uppercase">{activeChat.name.charAt(0)}</div>
              <h4 className="text-base font-bold text-gray-950 m-0 mb-1">{activeChat.name}</h4>
              <span className="text-xs text-gray-400 block break-all">ID: {activeChat.igsid}</span>
            </div>
            <div className="flex flex-col gap-3">
              <h5 className="text-[10px] font-bold text-gray-400 tracking-wider m-0 uppercase">Installation Site</h5>
              <div className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm h-32 bg-slate-100">
                <img src="https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=500&auto=format&fit=crop" alt="Site" className="w-full h-full object-cover" />
              </div>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}

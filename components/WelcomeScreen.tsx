import React from 'react';

// New, larger logo for the welcome screen
const LogoIcon = () => (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-6 drop-shadow-lg">
        <rect x="4.75" y="4.75" width="14.5" height="14.5" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-[var(--border-primary)] opacity-50"/>
        <line x1="12" y1="4.75" x2="12" y2="19.25" stroke="currentColor" strokeWidth="1.5" className="text-[var(--border-primary)] opacity-50"/>
        <path d="M16 9.5L16.5 11.5L18.5 12L16.5 12.5L16 14.5L15.5 12.5L13.5 12L15.5 11.5L16 9.5Z" fill="currentColor" className="text-[var(--accent-primary)]"/>
    </svg>
);


// Icons for the tips section
const SettingsTipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-3 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);
const ProjectTipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-3 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
);
const TranslateTipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-3 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10-5-10M17 3l5 10-5 10" />
    </svg>
);
const GlossaryTipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-3 text-[var(--accent-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
);


const WelcomeScreen = () => {
    return (
        <div 
            className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in"
            style={{ background: 'radial-gradient(circle at top, var(--bg-secondary) 0%, var(--bg-primary) 100%)' }}
        >
            <LogoIcon />
            <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2 tracking-tight flex items-center justify-center gap-3">
                Welcome to Lingua Scripter
                <span className="text-base font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-3 py-1 rounded-full">by Subscribe</span>
            </h1>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mb-16">
                Your AI-powered assistant for seamless novel translation. Organize projects, maintain consistency with a custom glossary, and bring your stories to a new audience.
            </p>
            <div className="w-full max-w-5xl">
                <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-8">How to Get Started</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-primary)] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                        <SettingsTipIcon />
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">1. Set Your API Key</h3>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Click the settings icon in the top right to enter your Google Gemini API key and connect to the AI.</p>
                    </div>
                    <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-primary)] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                        <ProjectTipIcon />
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">2. Create a Project</h3>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Use the sidebar to create a project for each novel. This keeps your chapters and glossaries organized.</p>
                    </div>
                     <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-primary)] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                        <TranslateTipIcon />
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">3. Translate & Save</h3>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Add a new chapter, paste your text, and hit Translate. Don't forget to save your progress!</p>
                    </div>
                    <div className="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-primary)] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                        <GlossaryTipIcon />
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">4. Build Your Glossary</h3>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">For key terms, names, or places, add them to the project's glossary to ensure perfect consistency every time.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeScreen;
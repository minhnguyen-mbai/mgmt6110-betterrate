import React, { useEffect } from 'react';

const DISQUS_SHORTNAME = 'betterrate-mbai';
const DISQUS_PAGE_URL = 'https://mgmt6110-betterrate.vercel.app/';
const DISQUS_PAGE_IDENTIFIER = 'home';
const DISQUS_SCRIPT_ID = 'dsq-embed-scr';

declare global {
  interface Window {
    disqus_config?: (this: { page: { url: string; identifier: string } }) => void;
    DISQUS?: { reset: (options: { reload: boolean; config: Window['disqus_config'] }) => void };
  }
}

export function DisqusComments() {
  useEffect(() => {
    // Single fixed thread for the whole app, regardless of the current screen.
    window.disqus_config = function () {
      this.page.url = DISQUS_PAGE_URL;
      this.page.identifier = DISQUS_PAGE_IDENTIFIER;
    };

    // Load embed.js only once; if it already exists, re-render the same thread.
    if (document.getElementById(DISQUS_SCRIPT_ID)) {
      window.DISQUS?.reset({ reload: true, config: window.disqus_config });
      return;
    }

    const script = document.createElement('script');
    script.id = DISQUS_SCRIPT_ID;
    script.src = `https://${DISQUS_SHORTNAME}.disqus.com/embed.js`;
    script.async = true;
    script.setAttribute('data-timestamp', String(Date.now()));
    (document.head || document.body).appendChild(script);
  }, []);

  return (
    <section id="app-comments" className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 pb-6 sm:pb-8">
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3">
        <p className="text-sm text-slate-600">Tell us what worked for you and what did not.</p>
        <div id="disqus_thread" />
      </div>
    </section>
  );
}

// GitHub Pages sends records to the online collector; no credentials belong here.
window.ROSE_ANALYTICS_ENDPOINT = location.hostname === 'programmer-shadow.github.io'
  ? 'https://rose-records-shadow-20260918.xiekun519686353.chatgpt.site/events'
  : ['127.0.0.1', 'localhost'].includes(location.hostname) ? '/events' : '';

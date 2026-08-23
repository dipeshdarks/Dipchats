const DEFAULT_SEO = {
  title: 'DipChats — Real-Time Chat for People, Communities & Conversations',
  description: 'DipChats is a real-time chat platform for people, communities, and conversations. Join channels, discover people, send messages instantly. Private, secure, and free.',
  url: 'https://dipchats.vercel.app',
  image: 'https://dipchats.vercel.app/og-image.png',
  type: 'website' as const
};

const PAGE_SEO: Record<string, Partial<typeof DEFAULT_SEO>> = {
  chats: {
    title: 'Chats — DipChats',
    description: 'Your real-time chat conversations. Send messages instantly to channels and people on DipChats.'
  },
  channels: {
    title: 'Channels — DipChats',
    description: 'Browse and join public channels on DipChats. Find communities for gaming, music, coding, and more.'
  },
  discover: {
    title: 'Discover — DipChats',
    description: 'Discover new channels and communities on DipChats. Find people and conversations that interest you.'
  },
  people: {
    title: 'People — DipChats',
    description: 'Find and connect with people on DipChats. Discover users, send messages, and build connections.'
  },
  mesh: {
    title: 'Mesh Network — DipChats',
    description: 'DipChats mesh network status. View connected nodes and real-time communication topology.'
  },
  settings: {
    title: 'Settings — DipChats',
    description: 'Manage your DipChats profile, preferences, and account settings.'
  },
  profile: {
    title: 'Profile — DipChats',
    description: 'View and edit your DipChats profile. Update your display name, bio, and preferences.'
  },
  dm: {
    title: 'Direct Messages — DipChats',
    description: 'Private direct messages on DipChats. One-on-one conversations with end-to-end privacy.'
  }
};

export function updateSEO(page: string) {
  const seo = { ...DEFAULT_SEO, ...PAGE_SEO[page] };

  document.title = seo.title;

  setMeta('description', seo.description);
  setMeta('og:title', seo.title, 'property');
  setMeta('og:description', seo.description, 'property');
  setMeta('og:url', seo.url, 'property');
  setMeta('og:image', seo.image, 'property');
  setMeta('twitter:title', seo.title);
  setMeta('twitter:description', seo.description);
  setMeta('twitter:image', seo.image);

  setCanonical(seo.url);
}

function setMeta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let el = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

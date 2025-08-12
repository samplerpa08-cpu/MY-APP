/**
 * Service Worker for Tour Plan Management App
 * Provides offline functionality and caching
 */

const CACHE_NAME = 'tour-plan-v1.0.0';
const STATIC_CACHE_NAME = 'tour-plan-static-v1.0.0';

// Files to cache for offline functionality
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/utils.js',
    '/js/storage.js',
    '/js/api.js',
    '/js/auth.js',
    '/js/ui.js',
    '/js/app.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
    /\/\.netlify\/functions\/users$/,
    /\/\.netlify\/functions\/plans\/get$/,
    /\/\.netlify\/functions\/override$/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
            }),
            caches.open(CACHE_NAME).then((cache) => {
                // Pre-warm cache is empty for now
                return Promise.resolve();
            })
        ]).then(() => {
            console.log('Service Worker installation complete');
            // Force activation
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activation complete');
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});

// Fetch event - handle requests with caching strategy
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Handle different types of requests
    if (isStaticAsset(request)) {
        event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
    } else if (isAPIRequest(request)) {
        event.respondWith(networkFirstStrategy(request, CACHE_NAME));
    } else if (isGoogleFonts(request)) {
        event.respondWith(staleWhileRevalidateStrategy(request, STATIC_CACHE_NAME));
    } else {
        event.respondWith(networkFirstStrategy(request, CACHE_NAME));
    }
});

// Background sync event
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-queue') {
        event.waitUntil(syncQueuedRequests());
    }
});

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'CACHE_API_RESPONSE':
            cacheAPIResponse(data.url, data.response);
            break;
        case 'CLEAR_CACHE':
            clearAllCaches().then(() => {
                event.ports[0].postMessage({ success: true });
            });
            break;
        case 'GET_CACHE_STATUS':
            getCacheStatus().then((status) => {
                event.ports[0].postMessage(status);
            });
            break;
    }
});

/**
 * Cache-first strategy: Check cache first, fallback to network
 */
async function cacheFirstStrategy(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            cache.put(request.clone(), networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Cache-first strategy failed:', error);
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

/**
 * Network-first strategy: Try network first, fallback to cache
 */
async function networkFirstStrategy(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request.clone(), networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Network failed, trying cache:', request.url);
        
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline response for API requests
        if (isAPIRequest(request)) {
            return new Response(JSON.stringify({ 
                ok: false, 
                message: 'Offline - request queued',
                offline: true 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

/**
 * Stale-while-revalidate strategy: Return cache immediately, update in background
 */
async function staleWhileRevalidateStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Fetch fresh version in background
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request.clone(), networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => {
        // Network failed, but we might have cache
        return cachedResponse;
    });
    
    // Return cached version immediately if available
    return cachedResponse || fetchPromise;
}

/**
 * Check if request is for static assets
 */
function isStaticAsset(request) {
    const url = new URL(request.url);
    return url.pathname.endsWith('.html') ||
           url.pathname.endsWith('.css') ||
           url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.json') ||
           url.pathname === '/';
}

/**
 * Check if request is for API endpoints
 */
function isAPIRequest(request) {
    return API_CACHE_PATTERNS.some(pattern => pattern.test(request.url));
}

/**
 * Check if request is for Google Fonts
 */
function isGoogleFonts(request) {
    return request.url.includes('fonts.googleapis.com') || 
           request.url.includes('fonts.gstatic.com');
}

/**
 * Cache API response manually
 */
async function cacheAPIResponse(url, responseData) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = new Response(JSON.stringify(responseData), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put(url, response);
    } catch (error) {
        console.error('Error caching API response:', error);
    }
}

/**
 * Sync queued requests when back online
 */
async function syncQueuedRequests() {
    try {
        // This would typically sync with the main app's sync queue
        // For now, we just notify the main thread
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({ type: 'SYNC_REQUESTED' });
        });
        
        console.log('Background sync completed');
    } catch (error) {
        console.error('Background sync failed:', error);
        throw error; // This will retry the sync
    }
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('All caches cleared');
}

/**
 * Get cache status information
 */
async function getCacheStatus() {
    const cacheNames = await caches.keys();
    const status = {};
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        status[cacheName] = {
            count: keys.length,
            urls: keys.map(request => request.url)
        };
    }
    
    return {
        caches: status,
        isOnline: navigator.onLine
    };
}

// Periodic cleanup of old cache entries
setInterval(async () => {
    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        for (const request of requests) {
            const response = await cache.match(request);
            const dateHeader = response.headers.get('date');
            
            if (dateHeader && new Date(dateHeader).getTime() < oneWeekAgo) {
                await cache.delete(request);
                console.log('Cleaned up old cache entry:', request.url);
            }
        }
    } catch (error) {
        console.error('Cache cleanup failed:', error);
    }
}, 24 * 60 * 60 * 1000); // Run once per day
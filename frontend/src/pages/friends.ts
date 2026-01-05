/**
 * Friends Page
 *
 * Features:
 * - Friends list with online status indicators
 * - Pending friend requests (incoming)
 * - User search to send friend requests
 * - Notifications list
 */

import { getCurrentUser } from '../utils/auth';
import { getWebSocketManager } from '../utils/websocket';
import { escapeHtml } from '../utils/sanitize';
import { toast } from '../utils/toast';
import { showConfirmModal } from '../utils/modal';

// Types - match backend API response structure
interface Friend {
  id: string;
  alias: string;
  isOnline: boolean;
  lastSeenAt: string | null;
}

interface PendingRequest {
  id: string; // friendship ID for accept/decline
  userId: string;
  alias: string;
  createdAt: string;
}

interface SearchUser {
  id: string;
  alias: string;
  isOnline: boolean;
  isFriend: boolean;
  isPending: boolean;
}

interface Notification {
  id: string;
  type: 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED';
  data: { fromUserId?: string; fromAlias?: string; friendId?: string; friendAlias?: string };
  read: boolean;
  createdAt: string;
}

// Page state
let currentTab: 'friends' | 'requests' | 'search' | 'notifications' = 'friends';
let friends: Friend[] = [];
let pendingRequests: PendingRequest[] = [];
let searchResults: SearchUser[] = [];
let notifications: Notification[] = [];
let searchQuery = '';
let searchCursor: string | null = null;
let hasMoreSearchResults = false;
const onlineFriendIds = new Set<string>();

// Cleanup function for WebSocket handlers
let cleanupFn: (() => void) | null = null;

/**
 * Format "last seen" time
 */
function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Never';

  const lastSeen = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return lastSeen.toLocaleDateString();
}

/**
 * Format notification time
 */
function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/**
 * Fetch friends list
 */
async function fetchFriends(): Promise<void> {
  try {
    const response = await fetch('/api/friends', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      friends = data.friends || [];

      // Update online status from WebSocket tracking (merge with server-provided status)
      friends.forEach((f) => {
        if (onlineFriendIds.has(f.id)) {
          f.isOnline = true;
        }
      });
    }
  } catch (err) {
    console.error('[Friends] Failed to fetch friends:', err);
  }
}

/**
 * Fetch pending friend requests
 */
async function fetchPendingRequests(): Promise<void> {
  try {
    const response = await fetch('/api/friends/requests', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      // API returns { received: [], sent: [] } - we show received requests
      pendingRequests = data.received || [];
    }
  } catch (err) {
    console.error('[Friends] Failed to fetch requests:', err);
  }
}

/**
 * Search users
 */
async function searchUsers(query: string, cursor?: string): Promise<void> {
  if (query.length < 2) {
    searchResults = [];
    searchCursor = null;
    hasMoreSearchResults = false;
    return;
  }

  try {
    const params = new URLSearchParams({ q: query, limit: '20' });
    if (cursor) params.append('cursor', cursor);

    const response = await fetch(`/api/users/search?${params}`, { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      if (cursor) {
        // Append to existing results
        searchResults = [...searchResults, ...data.users];
      } else {
        searchResults = data.users || [];
      }
      searchCursor = data.nextCursor || null;
      hasMoreSearchResults = !!data.nextCursor;
    }
  } catch (err) {
    console.error('[Friends] Failed to search users:', err);
  }
}

/**
 * Fetch notifications
 */
async function fetchNotifications(): Promise<void> {
  try {
    const response = await fetch('/api/notifications', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      notifications = data.notifications || [];
    }
  } catch (err) {
    console.error('[Friends] Failed to fetch notifications:', err);
  }
}

/**
 * Send friend request
 */
async function sendFriendRequest(userId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/friends/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
      credentials: 'include',
    });

    if (response.ok) {
      toast.success('Friend request sent!');
      return true;
    } else {
      const data = await response.json();
      toast.error(data.error || data.message || 'Failed to send request');
      return false;
    }
  } catch {
    toast.error('Failed to send request');
    return false;
  }
}

/**
 * Accept friend request
 */
async function acceptFriendRequest(friendshipId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/friends/${friendshipId}/accept`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      toast.success('Friend request accepted!');
      return true;
    } else {
      const data = await response.json();
      toast.error(data.message || 'Failed to accept request');
      return false;
    }
  } catch {
    toast.error('Failed to accept request');
    return false;
  }
}

/**
 * Decline friend request
 */
async function declineFriendRequest(friendshipId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/friends/${friendshipId}/decline`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      toast.success('Friend request declined');
      return true;
    } else {
      const data = await response.json();
      toast.error(data.message || 'Failed to decline request');
      return false;
    }
  } catch {
    toast.error('Failed to decline request');
    return false;
  }
}

/**
 * Remove friend
 */
async function removeFriend(friendshipId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/friends/${friendshipId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (response.ok) {
      toast.success('Friend removed');
      return true;
    } else {
      const data = await response.json();
      toast.error(data.message || 'Failed to remove friend');
      return false;
    }
  } catch {
    toast.error('Failed to remove friend');
    return false;
  }
}

/**
 * Mark notification as read
 */
async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: [notificationId] }),
      credentials: 'include',
    });
    // Notify main.ts to update the bell badge
    window.dispatchEvent(new CustomEvent('notification:countChanged'));
  } catch (err) {
    console.error('[Friends] Failed to mark notification read:', err);
  }
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsRead(): Promise<void> {
  try {
    await fetch('/api/notifications/read-all', {
      method: 'POST',
      credentials: 'include',
    });
    notifications.forEach((n) => (n.read = true));
    // Notify main.ts to update the bell badge
    window.dispatchEvent(new CustomEvent('notification:countChanged'));
  } catch {
    console.error('[Friends] Failed to mark all read');
  }
}

/**
 * Get CSS classes for a tab button
 */
function getTabClasses(tab: 'friends' | 'requests' | 'search' | 'notifications'): string {
  const isActive = currentTab === tab;
  const base = 'py-2 px-1 border-b-2 font-medium text-sm transition';
  if (isActive) {
    return `${base} border-blue-500 text-blue-600`;
  }
  return `${base} border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300`;
}

/**
 * Render the tab content
 */
function renderTabContent(): string {
  switch (currentTab) {
    case 'friends':
      return renderFriendsList();
    case 'requests':
      return renderRequestsList();
    case 'search':
      return renderSearchTab();
    case 'notifications':
      return renderNotificationsList();
    default:
      return '';
  }
}

/**
 * Render friends list
 */
function renderFriendsList(): string {
  if (friends.length === 0) {
    return `
      <div class="text-center py-12 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <p class="text-lg font-medium mb-2">No friends yet</p>
        <p class="text-sm">Search for users to add them as friends!</p>
      </div>
    `;
  }

  // Sort: online first, then by alias
  const sortedFriends = [...friends].sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.alias.localeCompare(b.alias);
  });

  return `
    <div class="space-y-2">
      ${sortedFriends
        .map(
          (f) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
          <div class="flex items-center">
            <span class="w-3 h-3 rounded-full mr-3 ${f.isOnline ? 'bg-green-500' : 'bg-gray-400'}" title="${f.isOnline ? 'Online' : 'Offline'}"></span>
            <div>
              <span class="font-medium text-gray-900">${escapeHtml(f.alias)}</span>
              <p class="text-xs text-gray-500">
                ${f.isOnline ? 'Online now' : `Last seen: ${formatLastSeen(f.lastSeenAt)}`}
              </p>
            </div>
          </div>
          <button
            data-remove-friend="${f.id}"
            class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition"
          >
            Remove
          </button>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * Render pending requests list
 */
function renderRequestsList(): string {
  if (pendingRequests.length === 0) {
    return `
      <div class="text-center py-12 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        <p class="text-lg font-medium mb-2">No pending requests</p>
        <p class="text-sm">Friend requests will appear here</p>
      </div>
    `;
  }

  return `
    <div class="space-y-2">
      ${pendingRequests
        .map(
          (r) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <span class="font-medium text-gray-900">${escapeHtml(r.alias)}</span>
            <p class="text-xs text-gray-500">Sent ${formatNotificationTime(r.createdAt)}</p>
          </div>
          <div class="flex gap-2">
            <button
              data-accept-request="${r.id}"
              class="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded transition"
            >
              Accept
            </button>
            <button
              data-decline-request="${r.id}"
              class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded transition"
            >
              Decline
            </button>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * Render search tab
 */
function renderSearchTab(): string {
  return `
    <div class="mb-4">
      <div class="relative">
        <input
          type="text"
          id="user-search-input"
          placeholder="Search users by alias (min 2 characters)..."
          value="${escapeHtml(searchQuery)}"
          class="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <svg class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>
    </div>

    <div id="search-results">
      ${renderSearchResults()}
    </div>
  `;
}

/**
 * Render search results
 */
function renderSearchResults(): string {
  if (searchQuery.length < 2) {
    return `
      <div class="text-center py-8 text-gray-500">
        <p class="text-sm">Enter at least 2 characters to search</p>
      </div>
    `;
  }

  if (searchResults.length === 0) {
    return `
      <div class="text-center py-8 text-gray-500">
        <p class="text-sm">No users found matching "${escapeHtml(searchQuery)}"</p>
      </div>
    `;
  }

  return `
    <div class="space-y-2">
      ${searchResults
        .map(
          (u) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div class="flex items-center">
            <span class="w-3 h-3 rounded-full mr-3 ${u.isOnline ? 'bg-green-500' : 'bg-gray-400'}" title="${u.isOnline ? 'Online' : 'Offline'}"></span>
            <span class="font-medium text-gray-900">${escapeHtml(u.alias)}</span>
          </div>
          ${
            u.isFriend
              ? '<span class="text-sm text-green-600">✓ Friends</span>'
              : u.isPending
                ? '<span class="text-sm text-yellow-600">Pending</span>'
                : `<button data-add-friend="${u.id}" class="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition">Add Friend</button>`
          }
        </div>
      `
        )
        .join('')}

      ${
        hasMoreSearchResults
          ? `
        <button id="load-more-search" class="w-full py-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
          Load more results...
        </button>
      `
          : ''
      }
    </div>
  `;
}

/**
 * Render notifications list
 */
function renderNotificationsList(): string {
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (notifications.length === 0) {
    return `
      <div class="text-center py-12 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <p class="text-lg font-medium mb-2">No notifications</p>
        <p class="text-sm">You're all caught up!</p>
      </div>
    `;
  }

  return `
    ${
      unreadCount > 0
        ? `
      <div class="mb-4 flex justify-end">
        <button id="mark-all-read" class="text-sm text-blue-600 hover:text-blue-700">
          Mark all as read
        </button>
      </div>
    `
        : ''
    }

    <div class="space-y-2">
      ${notifications
        .map((n) => {
          const isUnread = !n.read;
          let message = '';
          let icon = '';

          // Both notification types use fromAlias to identify who triggered the action
          const senderAlias = n.data.fromAlias || 'Someone';

          if (n.type === 'FRIEND_REQUEST') {
            message = `<strong>${escapeHtml(senderAlias)}</strong> sent you a friend request`;
            icon = '👋';
          } else if (n.type === 'FRIEND_ACCEPTED') {
            message = `<strong>${escapeHtml(senderAlias)}</strong> accepted your friend request`;
            icon = '🎉';
          }

          return `
          <div class="flex items-start p-3 rounded-lg ${isUnread ? 'bg-blue-50' : 'bg-gray-50'}" data-notification-id="${n.id}">
            <span class="text-xl mr-3">${icon}</span>
            <div class="flex-1">
              <p class="text-sm text-gray-900">${message}</p>
              <p class="text-xs text-gray-500 mt-1">${formatNotificationTime(n.createdAt)}</p>
            </div>
            ${isUnread ? '<span class="w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

/**
 * Setup event handlers for the page
 */
function setupEventHandlers(app: HTMLElement): void {
  // Tab switching
  app.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const tab = (e.currentTarget as HTMLElement).dataset.tab as typeof currentTab;
      currentTab = tab;
      updateTabUI(app);
      await refreshTabData();
      updateContent(app);
    });
  });

  // Delegate event handling for dynamic content
  const content = app.querySelector('#tab-content');
  if (content) {
    content.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      // Add friend button
      const addFriendBtn = target.closest('[data-add-friend]') as HTMLButtonElement | null;
      if (addFriendBtn) {
        const userId = addFriendBtn.dataset.addFriend!;
        addFriendBtn.disabled = true;
        const success = await sendFriendRequest(userId);
        if (success) {
          // Update the button to show "Pending"
          const user = searchResults.find((u) => u.id === userId);
          if (user) user.isPending = true;
          updateContent(app);
        } else {
          addFriendBtn.disabled = false;
        }
      }

      // Accept request button
      const acceptBtn = target.closest('[data-accept-request]') as HTMLButtonElement | null;
      if (acceptBtn) {
        const friendshipId = acceptBtn.dataset.acceptRequest!;
        acceptBtn.disabled = true;
        const success = await acceptFriendRequest(friendshipId);
        if (success) {
          await fetchPendingRequests();
          await fetchFriends();
          updateContent(app);
        } else {
          acceptBtn.disabled = false;
        }
      }

      // Decline request button
      const declineBtn = target.closest('[data-decline-request]') as HTMLButtonElement | null;
      if (declineBtn) {
        const friendshipId = declineBtn.dataset.declineRequest!;
        declineBtn.disabled = true;
        const success = await declineFriendRequest(friendshipId);
        if (success) {
          await fetchPendingRequests();
          updateContent(app);
        } else {
          declineBtn.disabled = false;
        }
      }

      // Remove friend button
      const removeBtn = target.closest('[data-remove-friend]') as HTMLButtonElement | null;
      if (removeBtn) {
        const friendshipId = removeBtn.dataset.removeFriend!;
        const confirmed = await showConfirmModal({
          title: 'Remove Friend',
          message:
            'Are you sure you want to remove this friend? You can always add them back later.',
          confirmText: 'Remove',
          cancelText: 'Cancel',
          isDangerous: true,
        });
        if (confirmed) {
          removeBtn.disabled = true;
          const success = await removeFriend(friendshipId);
          if (success) {
            await fetchFriends();
            updateContent(app);
          } else {
            removeBtn.disabled = false;
          }
        }
      }

      // Load more search results
      if (target.id === 'load-more-search' && searchCursor) {
        target.textContent = 'Loading...';
        await searchUsers(searchQuery, searchCursor);
        updateContent(app);
      }

      // Mark all notifications as read
      if (target.id === 'mark-all-read') {
        await markAllNotificationsRead();
        updateContent(app);
      }

      // Click on notification to mark as read
      const notificationEl = target.closest('[data-notification-id]') as HTMLElement;
      if (notificationEl) {
        const notificationId = notificationEl.dataset.notificationId!;
        const notification = notifications.find((n) => n.id === notificationId);
        if (notification && !notification.read) {
          notification.read = true;
          await markNotificationRead(notificationId);
          updateContent(app);
        }
      }
    });

    // Search input handler
    content.addEventListener('input', async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id === 'user-search-input') {
        searchQuery = target.value;
        searchCursor = null;

        // Debounce search
        const inputValue = target.value;
        setTimeout(async () => {
          if (target.value === inputValue) {
            await searchUsers(searchQuery);
            const resultsEl = document.getElementById('search-results');
            if (resultsEl) {
              resultsEl.innerHTML = renderSearchResults();
            }
          }
        }, 300);
      }
    });
  }
}

/**
 * Update tab UI (active state)
 */
function updateTabUI(app: HTMLElement): void {
  app.querySelectorAll('[data-tab]').forEach((btn) => {
    const tab = (btn as HTMLElement).dataset.tab;
    if (tab === currentTab) {
      btn.classList.add('border-blue-500', 'text-blue-600');
      btn.classList.remove('border-transparent', 'text-gray-500');
    } else {
      btn.classList.remove('border-blue-500', 'text-blue-600');
      btn.classList.add('border-transparent', 'text-gray-500');
    }
  });
}

/**
 * Refresh data for current tab
 */
async function refreshTabData(): Promise<void> {
  switch (currentTab) {
    case 'friends':
      await fetchFriends();
      break;
    case 'requests':
      await fetchPendingRequests();
      break;
    case 'notifications':
      await fetchNotifications();
      break;
  }
}

/**
 * Update the content area
 */
function updateContent(app: HTMLElement): void {
  const contentEl = app.querySelector('#tab-content');
  if (contentEl) {
    contentEl.innerHTML = renderTabContent();
  }

  // Update request count badge
  const requestBadge = app.querySelector('#request-count');
  if (requestBadge) {
    if (pendingRequests.length > 0) {
      requestBadge.textContent = String(pendingRequests.length);
      requestBadge.classList.remove('hidden');
    } else {
      requestBadge.classList.add('hidden');
    }
  }

  // Update notification count badge
  const notificationBadge = app.querySelector('#notification-tab-count');
  const unreadCount = notifications.filter((n) => !n.read).length;
  if (notificationBadge) {
    if (unreadCount > 0) {
      notificationBadge.textContent = String(unreadCount);
      notificationBadge.classList.remove('hidden');
    } else {
      notificationBadge.classList.add('hidden');
    }
  }
}

/**
 * Render the friends page
 */
export async function renderFriendsPage(app: HTMLElement): Promise<void> {
  // Clean up previous handlers
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }

  const user = await getCurrentUser();
  if (!user) return;

  // Reset state
  currentTab = 'friends';
  searchQuery = '';
  searchCursor = null;
  searchResults = [];

  // Fetch initial data in parallel
  await Promise.all([fetchFriends(), fetchPendingRequests(), fetchNotifications()]);

  // Setup WebSocket handlers for real-time updates
  const wsManager = getWebSocketManager();

  const handleFriendOnline = (data: { friendId: string }) => {
    onlineFriendIds.add(data.friendId);
    const friend = friends.find((f) => f.id === data.friendId);
    if (friend) {
      friend.isOnline = true;
      if (currentTab === 'friends') {
        updateContent(app);
      }
    }
  };

  const handleFriendOffline = (data: { friendId: string }) => {
    onlineFriendIds.delete(data.friendId);
    const friend = friends.find((f) => f.id === data.friendId);
    if (friend) {
      friend.isOnline = false;
      if (currentTab === 'friends') {
        updateContent(app);
      }
    }
  };

  const handleNewNotification = async () => {
    // Fetch both notifications and pending requests (friend requests update both)
    await Promise.all([fetchNotifications(), fetchPendingRequests()]);
    // Notify main.ts to update the bell badge
    window.dispatchEvent(new CustomEvent('notification:countChanged'));
    updateContent(app);
  };

  const handleFriendAccepted = async (data: { friendId: string; friendAlias: string }) => {
    // Someone accepted our friend request - refresh friends list and search results
    await fetchFriends();
    // Update search results to show "Friends" instead of "Pending"
    const userInSearch = searchResults.find((u) => u.id === data.friendId);
    if (userInSearch) {
      userInSearch.isPending = false;
      userInSearch.isFriend = true;
    }
    updateContent(app);
  };

  wsManager.on('friend:online', handleFriendOnline);
  wsManager.on('friend:offline', handleFriendOffline);
  wsManager.on('notification:new', handleNewNotification);
  wsManager.on('friend:accepted', handleFriendAccepted);

  // Cleanup function
  cleanupFn = () => {
    wsManager.off('friend:online', handleFriendOnline);
    wsManager.off('friend:offline', handleFriendOffline);
    wsManager.off('notification:new', handleNewNotification);
    wsManager.off('friend:accepted', handleFriendAccepted);
  };

  // Render the page
  const navBar = await renderNavBarForFriends();

  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${navBar}

      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-6">Friends</h1>

        <!-- Tabs -->
        <div class="border-b border-gray-200 mb-6">
          <nav class="-mb-px flex space-x-8">
            <button data-tab="friends" class="${getTabClasses('friends')}">
              Friends
              <span class="ml-1 text-gray-400">(${friends.length})</span>
            </button>
            <button data-tab="requests" class="${getTabClasses('requests')} relative">
              Requests
              <span id="request-count" class="${pendingRequests.length > 0 ? '' : 'hidden'} ml-1 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">${pendingRequests.length}</span>
            </button>
            <button data-tab="search" class="${getTabClasses('search')}">
              Find Friends
            </button>
            <button data-tab="notifications" class="${getTabClasses('notifications')} relative">
              Notifications
              <span id="notification-tab-count" class="${notifications.filter((n) => !n.read).length > 0 ? '' : 'hidden'} ml-1 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">${notifications.filter((n) => !n.read).length}</span>
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div id="tab-content" class="bg-white rounded-lg shadow-lg p-6">
          ${renderTabContent()}
        </div>
      </div>
    </div>
  `;

  setupEventHandlers(app);
  setupNavigation();
}

/**
 * Helper to render navbar - imports from main
 * We need to pass through the navbar rendering
 */
async function renderNavBarForFriends(): Promise<string> {
  // We need to import from main but that creates circular dependency
  // Instead, we'll use a simpler inline approach
  const wsManager = getWebSocketManager();
  const isOnline = wsManager.isConnected;

  // Fetch user info
  const user = await getCurrentUser();
  const userAlias = user?.alias || '';

  // Fetch unread notification count
  let unreadCount = 0;
  try {
    const response = await fetch('/api/notifications/unread-count', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      unreadCount = data.count;
    }
  } catch {
    /* ignore */
  }

  return `
    <nav class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <h1 class="text-2xl font-bold text-gray-900">ft_transcendence</h1>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <button id="nav-home" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100">
              Home
            </button>
            <button id="nav-play" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100">
              Play
            </button>
            <button id="nav-tournaments" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100">
              Tournaments
            </button>
            <button id="nav-friends" class="px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600">
              Friends
            </button>
            <button id="nav-settings" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100">
              Settings
            </button>
            <div class="border-l border-gray-300 h-6 mx-2"></div>
            <!-- Notification Bell -->
            <button id="nav-notifications" class="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition" title="Notifications">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span id="notification-badge" class="${unreadCount > 0 ? '' : 'hidden'} absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                ${unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </button>
            <!-- User with Online Indicator -->
            <span class="flex items-center text-sm text-gray-600 px-2">
              <span id="online-indicator" class="w-2.5 h-2.5 rounded-full mr-2 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}" title="${isOnline ? 'Online' : 'Offline'}"></span>
              <span class="text-gray-400 mr-1">👤</span>
              <span id="nav-user-alias" class="font-medium">${userAlias}</span>
            </span>
            <button id="nav-logout" class="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;
}

/**
 * Setup navigation handlers (imported pattern from main)
 */
function setupNavigation(): void {
  const homeBtn = document.getElementById('nav-home');
  const playBtn = document.getElementById('nav-play');
  const tournamentsBtn = document.getElementById('nav-tournaments');
  const friendsBtn = document.getElementById('nav-friends');
  const settingsBtn = document.getElementById('nav-settings');
  const logoutBtn = document.getElementById('nav-logout');
  const notificationsBtn = document.getElementById('nav-notifications');

  const navigate = (page: string) => {
    window.history.pushState({ page }, '', `/${page === 'home' ? '' : page}`);
    window.dispatchEvent(new PopStateEvent('popstate', { state: { page } }));
  };

  homeBtn?.addEventListener('click', () => navigate('home'));
  playBtn?.addEventListener('click', () => navigate('play'));
  tournamentsBtn?.addEventListener('click', () => navigate('tournaments'));
  friendsBtn?.addEventListener('click', () => navigate('friends'));
  settingsBtn?.addEventListener('click', () => navigate('settings'));
  notificationsBtn?.addEventListener('click', () => {
    // Switch to notifications tab if already on friends page
    currentTab = 'notifications';
    const app = document.getElementById('root');
    if (app) {
      updateTabUI(app);
      refreshTabData().then(() => updateContent(app));
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    // Clean up before logout
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = null;
    }

    const { logout } = await import('../utils/auth');
    const { resetWebSocketManager } = await import('../utils/websocket');

    await logout();
    resetWebSocketManager();
    navigate('home');
  });
}

/**
 * Cleanup function called when leaving the page
 */
export function cleanupFriendsPage(): void {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}

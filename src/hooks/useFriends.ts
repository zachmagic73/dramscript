import { useState, useCallback } from 'react';
import type { FriendRequest, Friendship } from '../types';

export function useFriends() {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/friendships/accepted');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { friends: Friendship[] };
      setFriends(data.friends || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch friends';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/friendships/pending');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { friendRequests: FriendRequest[] };
      setPendingRequests(data.friendRequests || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch requests';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendFriendRequest = useCallback(async (addresseeId: string) => {
    try {
      const response = await fetch('/api/friendships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressee_id: addresseeId }),
      });
      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send request';
      setError(msg);
      return false;
    }
  }, []);

  const acceptFriendRequest = useCallback(async (friendshipId: string) => {
    try {
      const response = await fetch(`/api/friendships/${friendshipId}/accept`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Refresh both lists
      await Promise.all([fetchFriends(), fetchPendingRequests()]);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept request';
      setError(msg);
      return false;
    }
  }, [fetchFriends, fetchPendingRequests]);

  const rejectFriendRequest = useCallback(async (friendshipId: string) => {
    try {
      const response = await fetch(`/api/friendships/${friendshipId}/reject`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Refresh pending requests
      await fetchPendingRequests();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reject request';
      setError(msg);
      return false;
    }
  }, [fetchPendingRequests]);

  const unfriend = useCallback(async (friendshipId: string) => {
    try {
      const response = await fetch(`/api/friendships/${friendshipId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Refresh friends list
      await fetchFriends();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to unfriend';
      setError(msg);
      return false;
    }
  }, [fetchFriends]);

  return {
    friends,
    pendingRequests,
    loading,
    error,
    fetchFriends,
    fetchPendingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    unfriend,
  };
}

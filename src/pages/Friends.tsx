import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid2 as Grid, TextField, CircularProgress, Alert,
  Avatar, Button, InputAdornment,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import { useFriends } from '../hooks/useFriends';
import { useUserSearch } from '../hooks/useUserSearch';

export default function Friends() {
  const {
    friends,
    pendingRequests,
    fetchFriends,
    fetchPendingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    unfriend,
  } = useFriends();

  const { results: searchResults, searchUsers, clearResults, loading: searching } = useUserSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const [addingRequestId, setAddingRequestId] = useState<string | null>(null);

  useEffect(() => {
    fetchFriends();
    fetchPendingRequests();
  }, [fetchFriends, fetchPendingRequests]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim().length >= 2) {
      searchUsers(q);
    } else {
      clearResults();
    }
  };

  const handleAddFriend = async (userId: string) => {
    setAddingRequestId(userId);
    const success = await sendFriendRequest(userId);
    if (success) {
      setSearchQuery('');
      clearResults();
    }
    setAddingRequestId(null);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Friends
      </Typography>

      {/* Search to add friends */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Find & Add Friends
          </Typography>
          <TextField
            fullWidth
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searching ? (
                <InputAdornment position="end">
                  <CircularProgress size={18} color="primary" />
                </InputAdornment>
              ) : null,
            }}
          />
          {searchResults.length > 0 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {searchResults.map((user) => (
                <Grid key={user.id} size={{ xs: 12 }}>
                  <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', p: 1.5 }}>
                    <Avatar src={user.avatar_url || undefined} sx={{ mr: 1.5 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2">{user.display_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PersonAddIcon />}
                      onClick={() => handleAddFriend(user.id)}
                      disabled={addingRequestId === user.id}
                    >
                      {addingRequestId === user.id ? 'Sending...' : 'Add'}
                    </Button>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Pending friend requests */}
      {pendingRequests.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Pending Requests ({pendingRequests.length})
            </Typography>
            <Grid container spacing={2}>
              {pendingRequests.map((req) => (
                <Grid key={req.id} size={{ xs: 12 }}>
                  <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', p: 1.5 }}>
                    <Avatar src={req.avatar_url || undefined} sx={{ mr: 1.5 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2">{req.display_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {req.email}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => acceptFriendRequest(req.id)}
                      sx={{ mr: 1 }}
                    >
                      Accept
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<CancelIcon />}
                      onClick={() => rejectFriendRequest(req.id)}
                    >
                      Reject
                    </Button>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Friends list */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Friends ({friends.length})
          </Typography>
          {friends.length === 0 ? (
            <Alert severity="info">No friends yet. Search above to start adding friends!</Alert>
          ) : (
            <Grid container spacing={2}>
              {friends.map((friend) => (
                <Grid key={friend.id} size={{ xs: 12 }}>
                  <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', p: 1.5 }}>
                    <Avatar src={friend.avatar_url || undefined} sx={{ mr: 1.5 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2">{friend.display_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {friend.email}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<PersonRemoveIcon />}
                      onClick={() => unfriend(friend.id)}
                    >
                      Unfriend
                    </Button>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var playback_pb = require('./playback_pb.js');
var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');
var google_protobuf_empty_pb = require('google-protobuf/google/protobuf/empty_pb.js');
var media_pb = require('./media_pb.js');

function serialize_homeflix_playback_ContinueWatchingRequest(arg) {
  if (!(arg instanceof playback_pb.ContinueWatchingRequest)) {
    throw new Error('Expected argument of type homeflix.playback.ContinueWatchingRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_ContinueWatchingRequest(buffer_arg) {
  return playback_pb.ContinueWatchingRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_ContinueWatchingResponse(arg) {
  if (!(arg instanceof playback_pb.ContinueWatchingResponse)) {
    throw new Error('Expected argument of type homeflix.playback.ContinueWatchingResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_ContinueWatchingResponse(buffer_arg) {
  return playback_pb.ContinueWatchingResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_CreateWatchPartyRequest(arg) {
  if (!(arg instanceof playback_pb.CreateWatchPartyRequest)) {
    throw new Error('Expected argument of type homeflix.playback.CreateWatchPartyRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_CreateWatchPartyRequest(buffer_arg) {
  return playback_pb.CreateWatchPartyRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_GetMyListRequest(arg) {
  if (!(arg instanceof playback_pb.GetMyListRequest)) {
    throw new Error('Expected argument of type homeflix.playback.GetMyListRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_GetMyListRequest(buffer_arg) {
  return playback_pb.GetMyListRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_GetMyListResponse(arg) {
  if (!(arg instanceof playback_pb.GetMyListResponse)) {
    throw new Error('Expected argument of type homeflix.playback.GetMyListResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_GetMyListResponse(buffer_arg) {
  return playback_pb.GetMyListResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_InitializeProgressRequest(arg) {
  if (!(arg instanceof playback_pb.InitializeProgressRequest)) {
    throw new Error('Expected argument of type homeflix.playback.InitializeProgressRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_InitializeProgressRequest(buffer_arg) {
  return playback_pb.InitializeProgressRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_JoinWatchPartyRequest(arg) {
  if (!(arg instanceof playback_pb.JoinWatchPartyRequest)) {
    throw new Error('Expected argument of type homeflix.playback.JoinWatchPartyRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_JoinWatchPartyRequest(buffer_arg) {
  return playback_pb.JoinWatchPartyRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_MyListCheckResponse(arg) {
  if (!(arg instanceof playback_pb.MyListCheckResponse)) {
    throw new Error('Expected argument of type homeflix.playback.MyListCheckResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_MyListCheckResponse(buffer_arg) {
  return playback_pb.MyListCheckResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_MyListRequest(arg) {
  if (!(arg instanceof playback_pb.MyListRequest)) {
    throw new Error('Expected argument of type homeflix.playback.MyListRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_MyListRequest(buffer_arg) {
  return playback_pb.MyListRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_MyListResponse(arg) {
  if (!(arg instanceof playback_pb.MyListResponse)) {
    throw new Error('Expected argument of type homeflix.playback.MyListResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_MyListResponse(buffer_arg) {
  return playback_pb.MyListResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_PlaybackSync(arg) {
  if (!(arg instanceof playback_pb.PlaybackSync)) {
    throw new Error('Expected argument of type homeflix.playback.PlaybackSync');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_PlaybackSync(buffer_arg) {
  return playback_pb.PlaybackSync.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_PlaybackSyncResponse(arg) {
  if (!(arg instanceof playback_pb.PlaybackSyncResponse)) {
    throw new Error('Expected argument of type homeflix.playback.PlaybackSyncResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_PlaybackSyncResponse(buffer_arg) {
  return playback_pb.PlaybackSyncResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_ProgressRequest(arg) {
  if (!(arg instanceof playback_pb.ProgressRequest)) {
    throw new Error('Expected argument of type homeflix.playback.ProgressRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_ProgressRequest(buffer_arg) {
  return playback_pb.ProgressRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_ProgressResponse(arg) {
  if (!(arg instanceof playback_pb.ProgressResponse)) {
    throw new Error('Expected argument of type homeflix.playback.ProgressResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_ProgressResponse(buffer_arg) {
  return playback_pb.ProgressResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_ProgressUpdate(arg) {
  if (!(arg instanceof playback_pb.ProgressUpdate)) {
    throw new Error('Expected argument of type homeflix.playback.ProgressUpdate');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_ProgressUpdate(buffer_arg) {
  return playback_pb.ProgressUpdate.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_RecentlyWatchedRequest(arg) {
  if (!(arg instanceof playback_pb.RecentlyWatchedRequest)) {
    throw new Error('Expected argument of type homeflix.playback.RecentlyWatchedRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_RecentlyWatchedRequest(buffer_arg) {
  return playback_pb.RecentlyWatchedRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_RecentlyWatchedResponse(arg) {
  if (!(arg instanceof playback_pb.RecentlyWatchedResponse)) {
    throw new Error('Expected argument of type homeflix.playback.RecentlyWatchedResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_RecentlyWatchedResponse(buffer_arg) {
  return playback_pb.RecentlyWatchedResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_TrackViewRequest(arg) {
  if (!(arg instanceof playback_pb.TrackViewRequest)) {
    throw new Error('Expected argument of type homeflix.playback.TrackViewRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_TrackViewRequest(buffer_arg) {
  return playback_pb.TrackViewRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_TrackViewResponse(arg) {
  if (!(arg instanceof playback_pb.TrackViewResponse)) {
    throw new Error('Expected argument of type homeflix.playback.TrackViewResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_TrackViewResponse(buffer_arg) {
  return playback_pb.TrackViewResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_ViewHistoryRequest(arg) {
  if (!(arg instanceof playback_pb.ViewHistoryRequest)) {
    throw new Error('Expected argument of type homeflix.playback.ViewHistoryRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_ViewHistoryRequest(buffer_arg) {
  return playback_pb.ViewHistoryRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_ViewHistoryResponse(arg) {
  if (!(arg instanceof playback_pb.ViewHistoryResponse)) {
    throw new Error('Expected argument of type homeflix.playback.ViewHistoryResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_ViewHistoryResponse(buffer_arg) {
  return playback_pb.ViewHistoryResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_WatchPartyEvent(arg) {
  if (!(arg instanceof playback_pb.WatchPartyEvent)) {
    throw new Error('Expected argument of type homeflix.playback.WatchPartyEvent');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_WatchPartyEvent(buffer_arg) {
  return playback_pb.WatchPartyEvent.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_WatchPartyResponse(arg) {
  if (!(arg instanceof playback_pb.WatchPartyResponse)) {
    throw new Error('Expected argument of type homeflix.playback.WatchPartyResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_WatchPartyResponse(buffer_arg) {
  return playback_pb.WatchPartyResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_WatchStatsRequest(arg) {
  if (!(arg instanceof playback_pb.WatchStatsRequest)) {
    throw new Error('Expected argument of type homeflix.playback.WatchStatsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_WatchStatsRequest(buffer_arg) {
  return playback_pb.WatchStatsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_playback_WatchStatsResponse(arg) {
  if (!(arg instanceof playback_pb.WatchStatsResponse)) {
    throw new Error('Expected argument of type homeflix.playback.WatchStatsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_playback_WatchStatsResponse(buffer_arg) {
  return playback_pb.WatchStatsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


// Playback Service for tracking and analytics
var PlaybackServiceService = exports.PlaybackServiceService = {
  // Progress tracking with real-time sync
updateProgress: {
    path: '/homeflix.playback.PlaybackService/UpdateProgress',
    requestStream: true,
    responseStream: true,
    requestType: playback_pb.ProgressUpdate,
    responseType: playback_pb.ProgressResponse,
    requestSerialize: serialize_homeflix_playback_ProgressUpdate,
    requestDeserialize: deserialize_homeflix_playback_ProgressUpdate,
    responseSerialize: serialize_homeflix_playback_ProgressResponse,
    responseDeserialize: deserialize_homeflix_playback_ProgressResponse,
  },
  getProgress: {
    path: '/homeflix.playback.PlaybackService/GetProgress',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.ProgressRequest,
    responseType: playback_pb.ProgressResponse,
    requestSerialize: serialize_homeflix_playback_ProgressRequest,
    requestDeserialize: deserialize_homeflix_playback_ProgressRequest,
    responseSerialize: serialize_homeflix_playback_ProgressResponse,
    responseDeserialize: deserialize_homeflix_playback_ProgressResponse,
  },
  initializeProgress: {
    path: '/homeflix.playback.PlaybackService/InitializeProgress',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.InitializeProgressRequest,
    responseType: playback_pb.ProgressResponse,
    requestSerialize: serialize_homeflix_playback_InitializeProgressRequest,
    requestDeserialize: deserialize_homeflix_playback_InitializeProgressRequest,
    responseSerialize: serialize_homeflix_playback_ProgressResponse,
    responseDeserialize: deserialize_homeflix_playback_ProgressResponse,
  },
  // View tracking
trackView: {
    path: '/homeflix.playback.PlaybackService/TrackView',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.TrackViewRequest,
    responseType: playback_pb.TrackViewResponse,
    requestSerialize: serialize_homeflix_playback_TrackViewRequest,
    requestDeserialize: deserialize_homeflix_playback_TrackViewRequest,
    responseSerialize: serialize_homeflix_playback_TrackViewResponse,
    responseDeserialize: deserialize_homeflix_playback_TrackViewResponse,
  },
  getViewHistory: {
    path: '/homeflix.playback.PlaybackService/GetViewHistory',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.ViewHistoryRequest,
    responseType: playback_pb.ViewHistoryResponse,
    requestSerialize: serialize_homeflix_playback_ViewHistoryRequest,
    requestDeserialize: deserialize_homeflix_playback_ViewHistoryRequest,
    responseSerialize: serialize_homeflix_playback_ViewHistoryResponse,
    responseDeserialize: deserialize_homeflix_playback_ViewHistoryResponse,
  },
  getWatchStats: {
    path: '/homeflix.playback.PlaybackService/GetWatchStats',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.WatchStatsRequest,
    responseType: playback_pb.WatchStatsResponse,
    requestSerialize: serialize_homeflix_playback_WatchStatsRequest,
    requestDeserialize: deserialize_homeflix_playback_WatchStatsRequest,
    responseSerialize: serialize_homeflix_playback_WatchStatsResponse,
    responseDeserialize: deserialize_homeflix_playback_WatchStatsResponse,
  },
  // Continue watching
getContinueWatching: {
    path: '/homeflix.playback.PlaybackService/GetContinueWatching',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.ContinueWatchingRequest,
    responseType: playback_pb.ContinueWatchingResponse,
    requestSerialize: serialize_homeflix_playback_ContinueWatchingRequest,
    requestDeserialize: deserialize_homeflix_playback_ContinueWatchingRequest,
    responseSerialize: serialize_homeflix_playback_ContinueWatchingResponse,
    responseDeserialize: deserialize_homeflix_playback_ContinueWatchingResponse,
  },
  getRecentlyWatched: {
    path: '/homeflix.playback.PlaybackService/GetRecentlyWatched',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.RecentlyWatchedRequest,
    responseType: playback_pb.RecentlyWatchedResponse,
    requestSerialize: serialize_homeflix_playback_RecentlyWatchedRequest,
    requestDeserialize: deserialize_homeflix_playback_RecentlyWatchedRequest,
    responseSerialize: serialize_homeflix_playback_RecentlyWatchedResponse,
    responseDeserialize: deserialize_homeflix_playback_RecentlyWatchedResponse,
  },
  // My List management
addToMyList: {
    path: '/homeflix.playback.PlaybackService/AddToMyList',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.MyListRequest,
    responseType: playback_pb.MyListResponse,
    requestSerialize: serialize_homeflix_playback_MyListRequest,
    requestDeserialize: deserialize_homeflix_playback_MyListRequest,
    responseSerialize: serialize_homeflix_playback_MyListResponse,
    responseDeserialize: deserialize_homeflix_playback_MyListResponse,
  },
  removeFromMyList: {
    path: '/homeflix.playback.PlaybackService/RemoveFromMyList',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.MyListRequest,
    responseType: playback_pb.MyListResponse,
    requestSerialize: serialize_homeflix_playback_MyListRequest,
    requestDeserialize: deserialize_homeflix_playback_MyListRequest,
    responseSerialize: serialize_homeflix_playback_MyListResponse,
    responseDeserialize: deserialize_homeflix_playback_MyListResponse,
  },
  getMyList: {
    path: '/homeflix.playback.PlaybackService/GetMyList',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.GetMyListRequest,
    responseType: playback_pb.GetMyListResponse,
    requestSerialize: serialize_homeflix_playback_GetMyListRequest,
    requestDeserialize: deserialize_homeflix_playback_GetMyListRequest,
    responseSerialize: serialize_homeflix_playback_GetMyListResponse,
    responseDeserialize: deserialize_homeflix_playback_GetMyListResponse,
  },
  checkMyList: {
    path: '/homeflix.playback.PlaybackService/CheckMyList',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.MyListRequest,
    responseType: playback_pb.MyListCheckResponse,
    requestSerialize: serialize_homeflix_playback_MyListRequest,
    requestDeserialize: deserialize_homeflix_playback_MyListRequest,
    responseSerialize: serialize_homeflix_playback_MyListCheckResponse,
    responseDeserialize: deserialize_homeflix_playback_MyListCheckResponse,
  },
  // Real-time playback synchronization
syncPlayback: {
    path: '/homeflix.playback.PlaybackService/SyncPlayback',
    requestStream: true,
    responseStream: true,
    requestType: playback_pb.PlaybackSync,
    responseType: playback_pb.PlaybackSyncResponse,
    requestSerialize: serialize_homeflix_playback_PlaybackSync,
    requestDeserialize: deserialize_homeflix_playback_PlaybackSync,
    responseSerialize: serialize_homeflix_playback_PlaybackSyncResponse,
    responseDeserialize: deserialize_homeflix_playback_PlaybackSyncResponse,
  },
  // Watch party (future feature)
createWatchParty: {
    path: '/homeflix.playback.PlaybackService/CreateWatchParty',
    requestStream: false,
    responseStream: false,
    requestType: playback_pb.CreateWatchPartyRequest,
    responseType: playback_pb.WatchPartyResponse,
    requestSerialize: serialize_homeflix_playback_CreateWatchPartyRequest,
    requestDeserialize: deserialize_homeflix_playback_CreateWatchPartyRequest,
    responseSerialize: serialize_homeflix_playback_WatchPartyResponse,
    responseDeserialize: deserialize_homeflix_playback_WatchPartyResponse,
  },
  joinWatchParty: {
    path: '/homeflix.playback.PlaybackService/JoinWatchParty',
    requestStream: false,
    responseStream: true,
    requestType: playback_pb.JoinWatchPartyRequest,
    responseType: playback_pb.WatchPartyEvent,
    requestSerialize: serialize_homeflix_playback_JoinWatchPartyRequest,
    requestDeserialize: deserialize_homeflix_playback_JoinWatchPartyRequest,
    responseSerialize: serialize_homeflix_playback_WatchPartyEvent,
    responseDeserialize: deserialize_homeflix_playback_WatchPartyEvent,
  },
};

exports.PlaybackServiceClient = grpc.makeGenericClientConstructor(PlaybackServiceService, 'PlaybackService');

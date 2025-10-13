// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var homeflix_pb = require('./homeflix_pb.js');
var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');
var google_protobuf_empty_pb = require('google-protobuf/google/protobuf/empty_pb.js');

function serialize_google_protobuf_Empty(arg) {
  if (!(arg instanceof google_protobuf_empty_pb.Empty)) {
    throw new Error('Expected argument of type google.protobuf.Empty');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_google_protobuf_Empty(buffer_arg) {
  return google_protobuf_empty_pb.Empty.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_AdminPreviewQueue(arg) {
  if (!(arg instanceof homeflix_pb.AdminPreviewQueue)) {
    throw new Error('Expected argument of type homeflix.AdminPreviewQueue');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_AdminPreviewQueue(buffer_arg) {
  return homeflix_pb.AdminPreviewQueue.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_DeleteUserRequest(arg) {
  if (!(arg instanceof homeflix_pb.DeleteUserRequest)) {
    throw new Error('Expected argument of type homeflix.DeleteUserRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_DeleteUserRequest(buffer_arg) {
  return homeflix_pb.DeleteUserRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GeneratePreviewRequest(arg) {
  if (!(arg instanceof homeflix_pb.GeneratePreviewRequest)) {
    throw new Error('Expected argument of type homeflix.GeneratePreviewRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GeneratePreviewRequest(buffer_arg) {
  return homeflix_pb.GeneratePreviewRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GeneratePreviewResponse(arg) {
  if (!(arg instanceof homeflix_pb.GeneratePreviewResponse)) {
    throw new Error('Expected argument of type homeflix.GeneratePreviewResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GeneratePreviewResponse(buffer_arg) {
  return homeflix_pb.GeneratePreviewResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetAllUsersRequest(arg) {
  if (!(arg instanceof homeflix_pb.GetAllUsersRequest)) {
    throw new Error('Expected argument of type homeflix.GetAllUsersRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetAllUsersRequest(buffer_arg) {
  return homeflix_pb.GetAllUsersRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetAllUsersResponse(arg) {
  if (!(arg instanceof homeflix_pb.GetAllUsersResponse)) {
    throw new Error('Expected argument of type homeflix.GetAllUsersResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetAllUsersResponse(buffer_arg) {
  return homeflix_pb.GetAllUsersResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetByGenreRequest(arg) {
  if (!(arg instanceof homeflix_pb.GetByGenreRequest)) {
    throw new Error('Expected argument of type homeflix.GetByGenreRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetByGenreRequest(buffer_arg) {
  return homeflix_pb.GetByGenreRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetMovieRequest(arg) {
  if (!(arg instanceof homeflix_pb.GetMovieRequest)) {
    throw new Error('Expected argument of type homeflix.GetMovieRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetMovieRequest(buffer_arg) {
  return homeflix_pb.GetMovieRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetMoviesRequest(arg) {
  if (!(arg instanceof homeflix_pb.GetMoviesRequest)) {
    throw new Error('Expected argument of type homeflix.GetMoviesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetMoviesRequest(buffer_arg) {
  return homeflix_pb.GetMoviesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetMoviesResponse(arg) {
  if (!(arg instanceof homeflix_pb.GetMoviesResponse)) {
    throw new Error('Expected argument of type homeflix.GetMoviesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetMoviesResponse(buffer_arg) {
  return homeflix_pb.GetMoviesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetRecentRequest(arg) {
  if (!(arg instanceof homeflix_pb.GetRecentRequest)) {
    throw new Error('Expected argument of type homeflix.GetRecentRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetRecentRequest(buffer_arg) {
  return homeflix_pb.GetRecentRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetSeriesRequest(arg) {
  if (!(arg instanceof homeflix_pb.GetSeriesRequest)) {
    throw new Error('Expected argument of type homeflix.GetSeriesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetSeriesRequest(buffer_arg) {
  return homeflix_pb.GetSeriesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetSeriesResponse(arg) {
  if (!(arg instanceof homeflix_pb.GetSeriesResponse)) {
    throw new Error('Expected argument of type homeflix.GetSeriesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetSeriesResponse(buffer_arg) {
  return homeflix_pb.GetSeriesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetUserPreferencesRequest(arg) {
  if (!(arg instanceof homeflix_pb.GetUserPreferencesRequest)) {
    throw new Error('Expected argument of type homeflix.GetUserPreferencesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetUserPreferencesRequest(buffer_arg) {
  return homeflix_pb.GetUserPreferencesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetWatchHistoryRequest(arg) {
  if (!(arg instanceof homeflix_pb.GetWatchHistoryRequest)) {
    throw new Error('Expected argument of type homeflix.GetWatchHistoryRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetWatchHistoryRequest(buffer_arg) {
  return homeflix_pb.GetWatchHistoryRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_GetWatchHistoryResponse(arg) {
  if (!(arg instanceof homeflix_pb.GetWatchHistoryResponse)) {
    throw new Error('Expected argument of type homeflix.GetWatchHistoryResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_GetWatchHistoryResponse(buffer_arg) {
  return homeflix_pb.GetWatchHistoryResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_LoginRequest(arg) {
  if (!(arg instanceof homeflix_pb.LoginRequest)) {
    throw new Error('Expected argument of type homeflix.LoginRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_LoginRequest(buffer_arg) {
  return homeflix_pb.LoginRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_LoginResponse(arg) {
  if (!(arg instanceof homeflix_pb.LoginResponse)) {
    throw new Error('Expected argument of type homeflix.LoginResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_LoginResponse(buffer_arg) {
  return homeflix_pb.LoginResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_MediaListResponse(arg) {
  if (!(arg instanceof homeflix_pb.MediaListResponse)) {
    throw new Error('Expected argument of type homeflix.MediaListResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_MediaListResponse(buffer_arg) {
  return homeflix_pb.MediaListResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_Movie(arg) {
  if (!(arg instanceof homeflix_pb.Movie)) {
    throw new Error('Expected argument of type homeflix.Movie');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_Movie(buffer_arg) {
  return homeflix_pb.Movie.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_PlaybackCommand(arg) {
  if (!(arg instanceof homeflix_pb.PlaybackCommand)) {
    throw new Error('Expected argument of type homeflix.PlaybackCommand');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_PlaybackCommand(buffer_arg) {
  return homeflix_pb.PlaybackCommand.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_PlaybackState(arg) {
  if (!(arg instanceof homeflix_pb.PlaybackState)) {
    throw new Error('Expected argument of type homeflix.PlaybackState');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_PlaybackState(buffer_arg) {
  return homeflix_pb.PlaybackState.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_PlaybackStateRequest(arg) {
  if (!(arg instanceof homeflix_pb.PlaybackStateRequest)) {
    throw new Error('Expected argument of type homeflix.PlaybackStateRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_PlaybackStateRequest(buffer_arg) {
  return homeflix_pb.PlaybackStateRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_PlaybackStatus(arg) {
  if (!(arg instanceof homeflix_pb.PlaybackStatus)) {
    throw new Error('Expected argument of type homeflix.PlaybackStatus');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_PlaybackStatus(buffer_arg) {
  return homeflix_pb.PlaybackStatus.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_PreviewProgress(arg) {
  if (!(arg instanceof homeflix_pb.PreviewProgress)) {
    throw new Error('Expected argument of type homeflix.PreviewProgress');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_PreviewProgress(buffer_arg) {
  return homeflix_pb.PreviewProgress.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_PreviewProgressRequest(arg) {
  if (!(arg instanceof homeflix_pb.PreviewProgressRequest)) {
    throw new Error('Expected argument of type homeflix.PreviewProgressRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_PreviewProgressRequest(buffer_arg) {
  return homeflix_pb.PreviewProgressRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_PreviewQueueStatus(arg) {
  if (!(arg instanceof homeflix_pb.PreviewQueueStatus)) {
    throw new Error('Expected argument of type homeflix.PreviewQueueStatus');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_PreviewQueueStatus(buffer_arg) {
  return homeflix_pb.PreviewQueueStatus.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_PreviewRequest(arg) {
  if (!(arg instanceof homeflix_pb.PreviewRequest)) {
    throw new Error('Expected argument of type homeflix.PreviewRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_PreviewRequest(buffer_arg) {
  return homeflix_pb.PreviewRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_PreviewStatus(arg) {
  if (!(arg instanceof homeflix_pb.PreviewStatus)) {
    throw new Error('Expected argument of type homeflix.PreviewStatus');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_PreviewStatus(buffer_arg) {
  return homeflix_pb.PreviewStatus.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_PreviewStatusRequest(arg) {
  if (!(arg instanceof homeflix_pb.PreviewStatusRequest)) {
    throw new Error('Expected argument of type homeflix.PreviewStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_PreviewStatusRequest(buffer_arg) {
  return homeflix_pb.PreviewStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_RateMediaRequest(arg) {
  if (!(arg instanceof homeflix_pb.RateMediaRequest)) {
    throw new Error('Expected argument of type homeflix.RateMediaRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_RateMediaRequest(buffer_arg) {
  return homeflix_pb.RateMediaRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_RateMediaResponse(arg) {
  if (!(arg instanceof homeflix_pb.RateMediaResponse)) {
    throw new Error('Expected argument of type homeflix.RateMediaResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_RateMediaResponse(buffer_arg) {
  return homeflix_pb.RateMediaResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_RecommendationRequest(arg) {
  if (!(arg instanceof homeflix_pb.RecommendationRequest)) {
    throw new Error('Expected argument of type homeflix.RecommendationRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_RecommendationRequest(buffer_arg) {
  return homeflix_pb.RecommendationRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_RecommendationResponse(arg) {
  if (!(arg instanceof homeflix_pb.RecommendationResponse)) {
    throw new Error('Expected argument of type homeflix.RecommendationResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_RecommendationResponse(buffer_arg) {
  return homeflix_pb.RecommendationResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_RecommendationStreamRequest(arg) {
  if (!(arg instanceof homeflix_pb.RecommendationStreamRequest)) {
    throw new Error('Expected argument of type homeflix.RecommendationStreamRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_RecommendationStreamRequest(buffer_arg) {
  return homeflix_pb.RecommendationStreamRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_RecommendationUpdate(arg) {
  if (!(arg instanceof homeflix_pb.RecommendationUpdate)) {
    throw new Error('Expected argument of type homeflix.RecommendationUpdate');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_RecommendationUpdate(buffer_arg) {
  return homeflix_pb.RecommendationUpdate.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_RefreshTokenRequest(arg) {
  if (!(arg instanceof homeflix_pb.RefreshTokenRequest)) {
    throw new Error('Expected argument of type homeflix.RefreshTokenRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_RefreshTokenRequest(buffer_arg) {
  return homeflix_pb.RefreshTokenRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_RefreshTokenResponse(arg) {
  if (!(arg instanceof homeflix_pb.RefreshTokenResponse)) {
    throw new Error('Expected argument of type homeflix.RefreshTokenResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_RefreshTokenResponse(buffer_arg) {
  return homeflix_pb.RefreshTokenResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_RegisterRequest(arg) {
  if (!(arg instanceof homeflix_pb.RegisterRequest)) {
    throw new Error('Expected argument of type homeflix.RegisterRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_RegisterRequest(buffer_arg) {
  return homeflix_pb.RegisterRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_RegisterResponse(arg) {
  if (!(arg instanceof homeflix_pb.RegisterResponse)) {
    throw new Error('Expected argument of type homeflix.RegisterResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_RegisterResponse(buffer_arg) {
  return homeflix_pb.RegisterResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_ScanLibraryRequest(arg) {
  if (!(arg instanceof homeflix_pb.ScanLibraryRequest)) {
    throw new Error('Expected argument of type homeflix.ScanLibraryRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_ScanLibraryRequest(buffer_arg) {
  return homeflix_pb.ScanLibraryRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_ScanProgress(arg) {
  if (!(arg instanceof homeflix_pb.ScanProgress)) {
    throw new Error('Expected argument of type homeflix.ScanProgress');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_ScanProgress(buffer_arg) {
  return homeflix_pb.ScanProgress.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_ScanStatus(arg) {
  if (!(arg instanceof homeflix_pb.ScanStatus)) {
    throw new Error('Expected argument of type homeflix.ScanStatus');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_ScanStatus(buffer_arg) {
  return homeflix_pb.ScanStatus.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_SearchRequest(arg) {
  if (!(arg instanceof homeflix_pb.SearchRequest)) {
    throw new Error('Expected argument of type homeflix.SearchRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_SearchRequest(buffer_arg) {
  return homeflix_pb.SearchRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_SearchResponse(arg) {
  if (!(arg instanceof homeflix_pb.SearchResponse)) {
    throw new Error('Expected argument of type homeflix.SearchResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_SearchResponse(buffer_arg) {
  return homeflix_pb.SearchResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_Series(arg) {
  if (!(arg instanceof homeflix_pb.Series)) {
    throw new Error('Expected argument of type homeflix.Series');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_Series(buffer_arg) {
  return homeflix_pb.Series.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_SimilarMediaRequest(arg) {
  if (!(arg instanceof homeflix_pb.SimilarMediaRequest)) {
    throw new Error('Expected argument of type homeflix.SimilarMediaRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_SimilarMediaRequest(buffer_arg) {
  return homeflix_pb.SimilarMediaRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_StreamChunk(arg) {
  if (!(arg instanceof homeflix_pb.StreamChunk)) {
    throw new Error('Expected argument of type homeflix.StreamChunk');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_StreamChunk(buffer_arg) {
  return homeflix_pb.StreamChunk.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_StreamInfo(arg) {
  if (!(arg instanceof homeflix_pb.StreamInfo)) {
    throw new Error('Expected argument of type homeflix.StreamInfo');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_StreamInfo(buffer_arg) {
  return homeflix_pb.StreamInfo.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_StreamInfoRequest(arg) {
  if (!(arg instanceof homeflix_pb.StreamInfoRequest)) {
    throw new Error('Expected argument of type homeflix.StreamInfoRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_StreamInfoRequest(buffer_arg) {
  return homeflix_pb.StreamInfoRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_StreamRequest(arg) {
  if (!(arg instanceof homeflix_pb.StreamRequest)) {
    throw new Error('Expected argument of type homeflix.StreamRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_StreamRequest(buffer_arg) {
  return homeflix_pb.StreamRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_StreamingMetrics(arg) {
  if (!(arg instanceof homeflix_pb.StreamingMetrics)) {
    throw new Error('Expected argument of type homeflix.StreamingMetrics');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_StreamingMetrics(buffer_arg) {
  return homeflix_pb.StreamingMetrics.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_SyncPlaybackRequest(arg) {
  if (!(arg instanceof homeflix_pb.SyncPlaybackRequest)) {
    throw new Error('Expected argument of type homeflix.SyncPlaybackRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_SyncPlaybackRequest(buffer_arg) {
  return homeflix_pb.SyncPlaybackRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_SyncPlaybackResponse(arg) {
  if (!(arg instanceof homeflix_pb.SyncPlaybackResponse)) {
    throw new Error('Expected argument of type homeflix.SyncPlaybackResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_SyncPlaybackResponse(buffer_arg) {
  return homeflix_pb.SyncPlaybackResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_SystemHealth(arg) {
  if (!(arg instanceof homeflix_pb.SystemHealth)) {
    throw new Error('Expected argument of type homeflix.SystemHealth');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_SystemHealth(buffer_arg) {
  return homeflix_pb.SystemHealth.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_UpdateUserPreferencesRequest(arg) {
  if (!(arg instanceof homeflix_pb.UpdateUserPreferencesRequest)) {
    throw new Error('Expected argument of type homeflix.UpdateUserPreferencesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_UpdateUserPreferencesRequest(buffer_arg) {
  return homeflix_pb.UpdateUserPreferencesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_UpdateWatchProgressRequest(arg) {
  if (!(arg instanceof homeflix_pb.UpdateWatchProgressRequest)) {
    throw new Error('Expected argument of type homeflix.UpdateWatchProgressRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_UpdateWatchProgressRequest(buffer_arg) {
  return homeflix_pb.UpdateWatchProgressRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_UserPreferences(arg) {
  if (!(arg instanceof homeflix_pb.UserPreferences)) {
    throw new Error('Expected argument of type homeflix.UserPreferences');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_UserPreferences(buffer_arg) {
  return homeflix_pb.UserPreferences.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_WatchProgress(arg) {
  if (!(arg instanceof homeflix_pb.WatchProgress)) {
    throw new Error('Expected argument of type homeflix.WatchProgress');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_WatchProgress(buffer_arg) {
  return homeflix_pb.WatchProgress.deserializeBinary(new Uint8Array(buffer_arg));
}


// ============================================================================
// Core Media Services
// ============================================================================
//
// Media metadata and information service
var MediaServiceService = exports.MediaServiceService = {
  // Get all movies with pagination
getMovies: {
    path: '/homeflix.MediaService/GetMovies',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.GetMoviesRequest,
    responseType: homeflix_pb.GetMoviesResponse,
    requestSerialize: serialize_homeflix_GetMoviesRequest,
    requestDeserialize: deserialize_homeflix_GetMoviesRequest,
    responseSerialize: serialize_homeflix_GetMoviesResponse,
    responseDeserialize: deserialize_homeflix_GetMoviesResponse,
  },
  // Get movie details by ID
getMovie: {
    path: '/homeflix.MediaService/GetMovie',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.GetMovieRequest,
    responseType: homeflix_pb.Movie,
    requestSerialize: serialize_homeflix_GetMovieRequest,
    requestDeserialize: deserialize_homeflix_GetMovieRequest,
    responseSerialize: serialize_homeflix_Movie,
    responseDeserialize: deserialize_homeflix_Movie,
  },
  // Get all TV series with pagination
getSeries: {
    path: '/homeflix.MediaService/GetSeries',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.GetSeriesRequest,
    responseType: homeflix_pb.GetSeriesResponse,
    requestSerialize: serialize_homeflix_GetSeriesRequest,
    requestDeserialize: deserialize_homeflix_GetSeriesRequest,
    responseSerialize: serialize_homeflix_GetSeriesResponse,
    responseDeserialize: deserialize_homeflix_GetSeriesResponse,
  },
  // Get series details by ID
getSeriesDetails: {
    path: '/homeflix.MediaService/GetSeriesDetails',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.GetSeriesRequest,
    responseType: homeflix_pb.Series,
    requestSerialize: serialize_homeflix_GetSeriesRequest,
    requestDeserialize: deserialize_homeflix_GetSeriesRequest,
    responseSerialize: serialize_homeflix_Series,
    responseDeserialize: deserialize_homeflix_Series,
  },
  // Search across all media
searchMedia: {
    path: '/homeflix.MediaService/SearchMedia',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.SearchRequest,
    responseType: homeflix_pb.SearchResponse,
    requestSerialize: serialize_homeflix_SearchRequest,
    requestDeserialize: deserialize_homeflix_SearchRequest,
    responseSerialize: serialize_homeflix_SearchResponse,
    responseDeserialize: deserialize_homeflix_SearchResponse,
  },
  // Get media by genre
getMediaByGenre: {
    path: '/homeflix.MediaService/GetMediaByGenre',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.GetByGenreRequest,
    responseType: homeflix_pb.MediaListResponse,
    requestSerialize: serialize_homeflix_GetByGenreRequest,
    requestDeserialize: deserialize_homeflix_GetByGenreRequest,
    responseSerialize: serialize_homeflix_MediaListResponse,
    responseDeserialize: deserialize_homeflix_MediaListResponse,
  },
  // Get recently added media
getRecentlyAdded: {
    path: '/homeflix.MediaService/GetRecentlyAdded',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.GetRecentRequest,
    responseType: homeflix_pb.MediaListResponse,
    requestSerialize: serialize_homeflix_GetRecentRequest,
    requestDeserialize: deserialize_homeflix_GetRecentRequest,
    responseSerialize: serialize_homeflix_MediaListResponse,
    responseDeserialize: deserialize_homeflix_MediaListResponse,
  },
};

exports.MediaServiceClient = grpc.makeGenericClientConstructor(MediaServiceService, 'MediaService');
// High-performance streaming service with Netflix-level optimization
var StreamingServiceService = exports.StreamingServiceService = {
  // Stream video with chunked responses and range support
streamVideo: {
    path: '/homeflix.StreamingService/StreamVideo',
    requestStream: false,
    responseStream: true,
    requestType: homeflix_pb.StreamRequest,
    responseType: homeflix_pb.StreamChunk,
    requestSerialize: serialize_homeflix_StreamRequest,
    requestDeserialize: deserialize_homeflix_StreamRequest,
    responseSerialize: serialize_homeflix_StreamChunk,
    responseDeserialize: deserialize_homeflix_StreamChunk,
  },
  // Stream audio with automatic transcoding
streamAudio: {
    path: '/homeflix.StreamingService/StreamAudio',
    requestStream: false,
    responseStream: true,
    requestType: homeflix_pb.StreamRequest,
    responseType: homeflix_pb.StreamChunk,
    requestSerialize: serialize_homeflix_StreamRequest,
    requestDeserialize: deserialize_homeflix_StreamRequest,
    responseSerialize: serialize_homeflix_StreamChunk,
    responseDeserialize: deserialize_homeflix_StreamChunk,
  },
  // Get stream info (codecs, bitrates, etc.)
getStreamInfo: {
    path: '/homeflix.StreamingService/GetStreamInfo',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.StreamInfoRequest,
    responseType: homeflix_pb.StreamInfo,
    requestSerialize: serialize_homeflix_StreamInfoRequest,
    requestDeserialize: deserialize_homeflix_StreamInfoRequest,
    responseSerialize: serialize_homeflix_StreamInfo,
    responseDeserialize: deserialize_homeflix_StreamInfo,
  },
  // Generate and stream preview clips
streamPreview: {
    path: '/homeflix.StreamingService/StreamPreview',
    requestStream: false,
    responseStream: true,
    requestType: homeflix_pb.PreviewRequest,
    responseType: homeflix_pb.StreamChunk,
    requestSerialize: serialize_homeflix_PreviewRequest,
    requestDeserialize: deserialize_homeflix_PreviewRequest,
    responseSerialize: serialize_homeflix_StreamChunk,
    responseDeserialize: deserialize_homeflix_StreamChunk,
  },
};

exports.StreamingServiceClient = grpc.makeGenericClientConstructor(StreamingServiceService, 'StreamingService');
// Real-time preview generation service
var PreviewServiceService = exports.PreviewServiceService = {
  // Generate preview for media item
generatePreview: {
    path: '/homeflix.PreviewService/GeneratePreview',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.GeneratePreviewRequest,
    responseType: homeflix_pb.GeneratePreviewResponse,
    requestSerialize: serialize_homeflix_GeneratePreviewRequest,
    requestDeserialize: deserialize_homeflix_GeneratePreviewRequest,
    responseSerialize: serialize_homeflix_GeneratePreviewResponse,
    responseDeserialize: deserialize_homeflix_GeneratePreviewResponse,
  },
  // Get preview generation status
getPreviewStatus: {
    path: '/homeflix.PreviewService/GetPreviewStatus',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.PreviewStatusRequest,
    responseType: homeflix_pb.PreviewStatus,
    requestSerialize: serialize_homeflix_PreviewStatusRequest,
    requestDeserialize: deserialize_homeflix_PreviewStatusRequest,
    responseSerialize: serialize_homeflix_PreviewStatus,
    responseDeserialize: deserialize_homeflix_PreviewStatus,
  },
  // Stream preview generation progress
streamPreviewProgress: {
    path: '/homeflix.PreviewService/StreamPreviewProgress',
    requestStream: false,
    responseStream: true,
    requestType: homeflix_pb.PreviewProgressRequest,
    responseType: homeflix_pb.PreviewProgress,
    requestSerialize: serialize_homeflix_PreviewProgressRequest,
    requestDeserialize: deserialize_homeflix_PreviewProgressRequest,
    responseSerialize: serialize_homeflix_PreviewProgress,
    responseDeserialize: deserialize_homeflix_PreviewProgress,
  },
  // Get preview queue status
getPreviewQueue: {
    path: '/homeflix.PreviewService/GetPreviewQueue',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: homeflix_pb.PreviewQueueStatus,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_PreviewQueueStatus,
    responseDeserialize: deserialize_homeflix_PreviewQueueStatus,
  },
};

exports.PreviewServiceClient = grpc.makeGenericClientConstructor(PreviewServiceService, 'PreviewService');
// User management and preferences
var UserServiceService = exports.UserServiceService = {
  // User authentication
login: {
    path: '/homeflix.UserService/Login',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.LoginRequest,
    responseType: homeflix_pb.LoginResponse,
    requestSerialize: serialize_homeflix_LoginRequest,
    requestDeserialize: deserialize_homeflix_LoginRequest,
    responseSerialize: serialize_homeflix_LoginResponse,
    responseDeserialize: deserialize_homeflix_LoginResponse,
  },
  register: {
    path: '/homeflix.UserService/Register',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.RegisterRequest,
    responseType: homeflix_pb.RegisterResponse,
    requestSerialize: serialize_homeflix_RegisterRequest,
    requestDeserialize: deserialize_homeflix_RegisterRequest,
    responseSerialize: serialize_homeflix_RegisterResponse,
    responseDeserialize: deserialize_homeflix_RegisterResponse,
  },
  refreshToken: {
    path: '/homeflix.UserService/RefreshToken',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.RefreshTokenRequest,
    responseType: homeflix_pb.RefreshTokenResponse,
    requestSerialize: serialize_homeflix_RefreshTokenRequest,
    requestDeserialize: deserialize_homeflix_RefreshTokenRequest,
    responseSerialize: serialize_homeflix_RefreshTokenResponse,
    responseDeserialize: deserialize_homeflix_RefreshTokenResponse,
  },
  // User preferences
getUserPreferences: {
    path: '/homeflix.UserService/GetUserPreferences',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.GetUserPreferencesRequest,
    responseType: homeflix_pb.UserPreferences,
    requestSerialize: serialize_homeflix_GetUserPreferencesRequest,
    requestDeserialize: deserialize_homeflix_GetUserPreferencesRequest,
    responseSerialize: serialize_homeflix_UserPreferences,
    responseDeserialize: deserialize_homeflix_UserPreferences,
  },
  updateUserPreferences: {
    path: '/homeflix.UserService/UpdateUserPreferences',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.UpdateUserPreferencesRequest,
    responseType: homeflix_pb.UserPreferences,
    requestSerialize: serialize_homeflix_UpdateUserPreferencesRequest,
    requestDeserialize: deserialize_homeflix_UpdateUserPreferencesRequest,
    responseSerialize: serialize_homeflix_UserPreferences,
    responseDeserialize: deserialize_homeflix_UserPreferences,
  },
  // Watch history and progress
updateWatchProgress: {
    path: '/homeflix.UserService/UpdateWatchProgress',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.UpdateWatchProgressRequest,
    responseType: homeflix_pb.WatchProgress,
    requestSerialize: serialize_homeflix_UpdateWatchProgressRequest,
    requestDeserialize: deserialize_homeflix_UpdateWatchProgressRequest,
    responseSerialize: serialize_homeflix_WatchProgress,
    responseDeserialize: deserialize_homeflix_WatchProgress,
  },
  getWatchHistory: {
    path: '/homeflix.UserService/GetWatchHistory',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.GetWatchHistoryRequest,
    responseType: homeflix_pb.GetWatchHistoryResponse,
    requestSerialize: serialize_homeflix_GetWatchHistoryRequest,
    requestDeserialize: deserialize_homeflix_GetWatchHistoryRequest,
    responseSerialize: serialize_homeflix_GetWatchHistoryResponse,
    responseDeserialize: deserialize_homeflix_GetWatchHistoryResponse,
  },
};

exports.UserServiceClient = grpc.makeGenericClientConstructor(UserServiceService, 'UserService');
// Real-time recommendation engine
var RecommendationServiceService = exports.RecommendationServiceService = {
  // Get personalized recommendations
getRecommendations: {
    path: '/homeflix.RecommendationService/GetRecommendations',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.RecommendationRequest,
    responseType: homeflix_pb.RecommendationResponse,
    requestSerialize: serialize_homeflix_RecommendationRequest,
    requestDeserialize: deserialize_homeflix_RecommendationRequest,
    responseSerialize: serialize_homeflix_RecommendationResponse,
    responseDeserialize: deserialize_homeflix_RecommendationResponse,
  },
  // Stream live recommendation updates
streamRecommendations: {
    path: '/homeflix.RecommendationService/StreamRecommendations',
    requestStream: false,
    responseStream: true,
    requestType: homeflix_pb.RecommendationStreamRequest,
    responseType: homeflix_pb.RecommendationUpdate,
    requestSerialize: serialize_homeflix_RecommendationStreamRequest,
    requestDeserialize: deserialize_homeflix_RecommendationStreamRequest,
    responseSerialize: serialize_homeflix_RecommendationUpdate,
    responseDeserialize: deserialize_homeflix_RecommendationUpdate,
  },
  // Update user rating
rateMedia: {
    path: '/homeflix.RecommendationService/RateMedia',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.RateMediaRequest,
    responseType: homeflix_pb.RateMediaResponse,
    requestSerialize: serialize_homeflix_RateMediaRequest,
    requestDeserialize: deserialize_homeflix_RateMediaRequest,
    responseSerialize: serialize_homeflix_RateMediaResponse,
    responseDeserialize: deserialize_homeflix_RateMediaResponse,
  },
  // Get similar media
getSimilarMedia: {
    path: '/homeflix.RecommendationService/GetSimilarMedia',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.SimilarMediaRequest,
    responseType: homeflix_pb.MediaListResponse,
    requestSerialize: serialize_homeflix_SimilarMediaRequest,
    requestDeserialize: deserialize_homeflix_SimilarMediaRequest,
    responseSerialize: serialize_homeflix_MediaListResponse,
    responseDeserialize: deserialize_homeflix_MediaListResponse,
  },
};

exports.RecommendationServiceClient = grpc.makeGenericClientConstructor(RecommendationServiceService, 'RecommendationService');
// Bidirectional playback control service
var PlaybackServiceService = exports.PlaybackServiceService = {
  // Bidirectional playback control stream
playbackControl: {
    path: '/homeflix.PlaybackService/PlaybackControl',
    requestStream: true,
    responseStream: true,
    requestType: homeflix_pb.PlaybackCommand,
    responseType: homeflix_pb.PlaybackStatus,
    requestSerialize: serialize_homeflix_PlaybackCommand,
    requestDeserialize: deserialize_homeflix_PlaybackCommand,
    responseSerialize: serialize_homeflix_PlaybackStatus,
    responseDeserialize: deserialize_homeflix_PlaybackStatus,
  },
  // Sync playback across devices
syncPlayback: {
    path: '/homeflix.PlaybackService/SyncPlayback',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.SyncPlaybackRequest,
    responseType: homeflix_pb.SyncPlaybackResponse,
    requestSerialize: serialize_homeflix_SyncPlaybackRequest,
    requestDeserialize: deserialize_homeflix_SyncPlaybackRequest,
    responseSerialize: serialize_homeflix_SyncPlaybackResponse,
    responseDeserialize: deserialize_homeflix_SyncPlaybackResponse,
  },
  // Get current playback state
getPlaybackState: {
    path: '/homeflix.PlaybackService/GetPlaybackState',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.PlaybackStateRequest,
    responseType: homeflix_pb.PlaybackState,
    requestSerialize: serialize_homeflix_PlaybackStateRequest,
    requestDeserialize: deserialize_homeflix_PlaybackStateRequest,
    responseSerialize: serialize_homeflix_PlaybackState,
    responseDeserialize: deserialize_homeflix_PlaybackState,
  },
};

exports.PlaybackServiceClient = grpc.makeGenericClientConstructor(PlaybackServiceService, 'PlaybackService');
// Admin and monitoring service
var AdminServiceService = exports.AdminServiceService = {
  // System health and metrics
getSystemHealth: {
    path: '/homeflix.AdminService/GetSystemHealth',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: homeflix_pb.SystemHealth,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_SystemHealth,
    responseDeserialize: deserialize_homeflix_SystemHealth,
  },
  getStreamingMetrics: {
    path: '/homeflix.AdminService/GetStreamingMetrics',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: homeflix_pb.StreamingMetrics,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_StreamingMetrics,
    responseDeserialize: deserialize_homeflix_StreamingMetrics,
  },
  // Media library management
scanMediaLibrary: {
    path: '/homeflix.AdminService/ScanMediaLibrary',
    requestStream: false,
    responseStream: true,
    requestType: homeflix_pb.ScanLibraryRequest,
    responseType: homeflix_pb.ScanProgress,
    requestSerialize: serialize_homeflix_ScanLibraryRequest,
    requestDeserialize: deserialize_homeflix_ScanLibraryRequest,
    responseSerialize: serialize_homeflix_ScanProgress,
    responseDeserialize: deserialize_homeflix_ScanProgress,
  },
  getScanStatus: {
    path: '/homeflix.AdminService/GetScanStatus',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: homeflix_pb.ScanStatus,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_ScanStatus,
    responseDeserialize: deserialize_homeflix_ScanStatus,
  },
  // Preview generation management
getPreviewQueueAdmin: {
    path: '/homeflix.AdminService/GetPreviewQueueAdmin',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: homeflix_pb.AdminPreviewQueue,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_AdminPreviewQueue,
    responseDeserialize: deserialize_homeflix_AdminPreviewQueue,
  },
  clearPreviewQueue: {
    path: '/homeflix.AdminService/ClearPreviewQueue',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: google_protobuf_empty_pb.Empty,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_google_protobuf_Empty,
    responseDeserialize: deserialize_google_protobuf_Empty,
  },
  // User management
getAllUsers: {
    path: '/homeflix.AdminService/GetAllUsers',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.GetAllUsersRequest,
    responseType: homeflix_pb.GetAllUsersResponse,
    requestSerialize: serialize_homeflix_GetAllUsersRequest,
    requestDeserialize: deserialize_homeflix_GetAllUsersRequest,
    responseSerialize: serialize_homeflix_GetAllUsersResponse,
    responseDeserialize: deserialize_homeflix_GetAllUsersResponse,
  },
  deleteUser: {
    path: '/homeflix.AdminService/DeleteUser',
    requestStream: false,
    responseStream: false,
    requestType: homeflix_pb.DeleteUserRequest,
    responseType: google_protobuf_empty_pb.Empty,
    requestSerialize: serialize_homeflix_DeleteUserRequest,
    requestDeserialize: deserialize_homeflix_DeleteUserRequest,
    responseSerialize: serialize_google_protobuf_Empty,
    responseDeserialize: deserialize_google_protobuf_Empty,
  },
};

exports.AdminServiceClient = grpc.makeGenericClientConstructor(AdminServiceService, 'AdminService');

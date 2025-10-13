// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var media_pb = require('./media_pb.js');
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

function serialize_homeflix_media_GetAllMediaRequest(arg) {
  if (!(arg instanceof media_pb.GetAllMediaRequest)) {
    throw new Error('Expected argument of type homeflix.media.GetAllMediaRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_GetAllMediaRequest(buffer_arg) {
  return media_pb.GetAllMediaRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_GetAllMediaResponse(arg) {
  if (!(arg instanceof media_pb.GetAllMediaResponse)) {
    throw new Error('Expected argument of type homeflix.media.GetAllMediaResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_GetAllMediaResponse(buffer_arg) {
  return media_pb.GetAllMediaResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_GetEpisodesBySeriesAndSeasonRequest(arg) {
  if (!(arg instanceof media_pb.GetEpisodesBySeriesAndSeasonRequest)) {
    throw new Error('Expected argument of type homeflix.media.GetEpisodesBySeriesAndSeasonRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_GetEpisodesBySeriesAndSeasonRequest(buffer_arg) {
  return media_pb.GetEpisodesBySeriesAndSeasonRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_GetMediaByGenreRequest(arg) {
  if (!(arg instanceof media_pb.GetMediaByGenreRequest)) {
    throw new Error('Expected argument of type homeflix.media.GetMediaByGenreRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_GetMediaByGenreRequest(buffer_arg) {
  return media_pb.GetMediaByGenreRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_GetMediaRequest(arg) {
  if (!(arg instanceof media_pb.GetMediaRequest)) {
    throw new Error('Expected argument of type homeflix.media.GetMediaRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_GetMediaRequest(buffer_arg) {
  return media_pb.GetMediaRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_GetSeasonsBySeriesRequest(arg) {
  if (!(arg instanceof media_pb.GetSeasonsBySeriesRequest)) {
    throw new Error('Expected argument of type homeflix.media.GetSeasonsBySeriesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_GetSeasonsBySeriesRequest(buffer_arg) {
  return media_pb.GetSeasonsBySeriesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_GetSeriesRequest(arg) {
  if (!(arg instanceof media_pb.GetSeriesRequest)) {
    throw new Error('Expected argument of type homeflix.media.GetSeriesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_GetSeriesRequest(buffer_arg) {
  return media_pb.GetSeriesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_LibraryUpdate(arg) {
  if (!(arg instanceof media_pb.LibraryUpdate)) {
    throw new Error('Expected argument of type homeflix.media.LibraryUpdate');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_LibraryUpdate(buffer_arg) {
  return media_pb.LibraryUpdate.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_Media(arg) {
  if (!(arg instanceof media_pb.Media)) {
    throw new Error('Expected argument of type homeflix.media.Media');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_Media(buffer_arg) {
  return media_pb.Media.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_SearchMediaRequest(arg) {
  if (!(arg instanceof media_pb.SearchMediaRequest)) {
    throw new Error('Expected argument of type homeflix.media.SearchMediaRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_SearchMediaRequest(buffer_arg) {
  return media_pb.SearchMediaRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_SearchMediaResponse(arg) {
  if (!(arg instanceof media_pb.SearchMediaResponse)) {
    throw new Error('Expected argument of type homeflix.media.SearchMediaResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_SearchMediaResponse(buffer_arg) {
  return media_pb.SearchMediaResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_Season(arg) {
  if (!(arg instanceof media_pb.Season)) {
    throw new Error('Expected argument of type homeflix.media.Season');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_Season(buffer_arg) {
  return media_pb.Season.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_media_Series(arg) {
  if (!(arg instanceof media_pb.Series)) {
    throw new Error('Expected argument of type homeflix.media.Series');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_media_Series(buffer_arg) {
  return media_pb.Series.deserializeBinary(new Uint8Array(buffer_arg));
}


// Media Service Definition
var MediaServiceService = exports.MediaServiceService = {
  // Basic CRUD
getMedia: {
    path: '/homeflix.media.MediaService/GetMedia',
    requestStream: false,
    responseStream: false,
    requestType: media_pb.GetMediaRequest,
    responseType: media_pb.Media,
    requestSerialize: serialize_homeflix_media_GetMediaRequest,
    requestDeserialize: deserialize_homeflix_media_GetMediaRequest,
    responseSerialize: serialize_homeflix_media_Media,
    responseDeserialize: deserialize_homeflix_media_Media,
  },
  getAllMedia: {
    path: '/homeflix.media.MediaService/GetAllMedia',
    requestStream: false,
    responseStream: false,
    requestType: media_pb.GetAllMediaRequest,
    responseType: media_pb.GetAllMediaResponse,
    requestSerialize: serialize_homeflix_media_GetAllMediaRequest,
    requestDeserialize: deserialize_homeflix_media_GetAllMediaRequest,
    responseSerialize: serialize_homeflix_media_GetAllMediaResponse,
    responseDeserialize: deserialize_homeflix_media_GetAllMediaResponse,
  },
  getMovies: {
    path: '/homeflix.media.MediaService/GetMovies',
    requestStream: false,
    responseStream: false,
    requestType: media_pb.GetAllMediaRequest,
    responseType: media_pb.GetAllMediaResponse,
    requestSerialize: serialize_homeflix_media_GetAllMediaRequest,
    requestDeserialize: deserialize_homeflix_media_GetAllMediaRequest,
    responseSerialize: serialize_homeflix_media_GetAllMediaResponse,
    responseDeserialize: deserialize_homeflix_media_GetAllMediaResponse,
  },
  getTVShows: {
    path: '/homeflix.media.MediaService/GetTVShows',
    requestStream: false,
    responseStream: false,
    requestType: media_pb.GetAllMediaRequest,
    responseType: media_pb.GetAllMediaResponse,
    requestSerialize: serialize_homeflix_media_GetAllMediaRequest,
    requestDeserialize: deserialize_homeflix_media_GetAllMediaRequest,
    responseSerialize: serialize_homeflix_media_GetAllMediaResponse,
    responseDeserialize: deserialize_homeflix_media_GetAllMediaResponse,
  },
  searchMedia: {
    path: '/homeflix.media.MediaService/SearchMedia',
    requestStream: false,
    responseStream: false,
    requestType: media_pb.SearchMediaRequest,
    responseType: media_pb.SearchMediaResponse,
    requestSerialize: serialize_homeflix_media_SearchMediaRequest,
    requestDeserialize: deserialize_homeflix_media_SearchMediaRequest,
    responseSerialize: serialize_homeflix_media_SearchMediaResponse,
    responseDeserialize: deserialize_homeflix_media_SearchMediaResponse,
  },
  getMediaByGenre: {
    path: '/homeflix.media.MediaService/GetMediaByGenre',
    requestStream: false,
    responseStream: false,
    requestType: media_pb.GetMediaByGenreRequest,
    responseType: media_pb.GetAllMediaResponse,
    requestSerialize: serialize_homeflix_media_GetMediaByGenreRequest,
    requestDeserialize: deserialize_homeflix_media_GetMediaByGenreRequest,
    responseSerialize: serialize_homeflix_media_GetAllMediaResponse,
    responseDeserialize: deserialize_homeflix_media_GetAllMediaResponse,
  },
  // Series and Seasons
getAllSeries: {
    path: '/homeflix.media.MediaService/GetAllSeries',
    requestStream: false,
    responseStream: true,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: media_pb.Series,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_media_Series,
    responseDeserialize: deserialize_homeflix_media_Series,
  },
  getSeries: {
    path: '/homeflix.media.MediaService/GetSeries',
    requestStream: false,
    responseStream: false,
    requestType: media_pb.GetSeriesRequest,
    responseType: media_pb.Series,
    requestSerialize: serialize_homeflix_media_GetSeriesRequest,
    requestDeserialize: deserialize_homeflix_media_GetSeriesRequest,
    responseSerialize: serialize_homeflix_media_Series,
    responseDeserialize: deserialize_homeflix_media_Series,
  },
  getSeasonsBySeries: {
    path: '/homeflix.media.MediaService/GetSeasonsBySeries',
    requestStream: false,
    responseStream: true,
    requestType: media_pb.GetSeasonsBySeriesRequest,
    responseType: media_pb.Season,
    requestSerialize: serialize_homeflix_media_GetSeasonsBySeriesRequest,
    requestDeserialize: deserialize_homeflix_media_GetSeasonsBySeriesRequest,
    responseSerialize: serialize_homeflix_media_Season,
    responseDeserialize: deserialize_homeflix_media_Season,
  },
  getEpisodesBySeriesAndSeason: {
    path: '/homeflix.media.MediaService/GetEpisodesBySeriesAndSeason',
    requestStream: false,
    responseStream: true,
    requestType: media_pb.GetEpisodesBySeriesAndSeasonRequest,
    responseType: media_pb.Media,
    requestSerialize: serialize_homeflix_media_GetEpisodesBySeriesAndSeasonRequest,
    requestDeserialize: deserialize_homeflix_media_GetEpisodesBySeriesAndSeasonRequest,
    responseSerialize: serialize_homeflix_media_Media,
    responseDeserialize: deserialize_homeflix_media_Media,
  },
  // Real-time updates
watchMediaUpdates: {
    path: '/homeflix.media.MediaService/WatchMediaUpdates',
    requestStream: false,
    responseStream: true,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: media_pb.Media,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_media_Media,
    responseDeserialize: deserialize_homeflix_media_Media,
  },
  watchLibraryChanges: {
    path: '/homeflix.media.MediaService/WatchLibraryChanges',
    requestStream: false,
    responseStream: true,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: media_pb.LibraryUpdate,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_media_LibraryUpdate,
    responseDeserialize: deserialize_homeflix_media_LibraryUpdate,
  },
};

exports.MediaServiceClient = grpc.makeGenericClientConstructor(MediaServiceService, 'MediaService');

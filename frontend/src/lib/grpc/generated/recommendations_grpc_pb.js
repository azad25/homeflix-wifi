// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var recommendations_pb = require('./recommendations_pb.js');
var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');
var google_protobuf_empty_pb = require('google-protobuf/google/protobuf/empty_pb.js');
var media_pb = require('./media_pb.js');

function serialize_google_protobuf_Empty(arg) {
  if (!(arg instanceof google_protobuf_empty_pb.Empty)) {
    throw new Error('Expected argument of type google.protobuf.Empty');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_google_protobuf_Empty(buffer_arg) {
  return google_protobuf_empty_pb.Empty.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_ContinueWatchingRequest(arg) {
  if (!(arg instanceof recommendations_pb.ContinueWatchingRequest)) {
    throw new Error('Expected argument of type homeflix.recommendations.ContinueWatchingRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_ContinueWatchingRequest(buffer_arg) {
  return recommendations_pb.ContinueWatchingRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_GenerateRequest(arg) {
  if (!(arg instanceof recommendations_pb.GenerateRequest)) {
    throw new Error('Expected argument of type homeflix.recommendations.GenerateRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_GenerateRequest(buffer_arg) {
  return recommendations_pb.GenerateRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_GenerateResponse(arg) {
  if (!(arg instanceof recommendations_pb.GenerateResponse)) {
    throw new Error('Expected argument of type homeflix.recommendations.GenerateResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_GenerateResponse(buffer_arg) {
  return recommendations_pb.GenerateResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_PersonalizedRequest(arg) {
  if (!(arg instanceof recommendations_pb.PersonalizedRequest)) {
    throw new Error('Expected argument of type homeflix.recommendations.PersonalizedRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_PersonalizedRequest(buffer_arg) {
  return recommendations_pb.PersonalizedRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_RecommendationRequest(arg) {
  if (!(arg instanceof recommendations_pb.RecommendationRequest)) {
    throw new Error('Expected argument of type homeflix.recommendations.RecommendationRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_RecommendationRequest(buffer_arg) {
  return recommendations_pb.RecommendationRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_RecommendationResponse(arg) {
  if (!(arg instanceof recommendations_pb.RecommendationResponse)) {
    throw new Error('Expected argument of type homeflix.recommendations.RecommendationResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_RecommendationResponse(buffer_arg) {
  return recommendations_pb.RecommendationResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_RecommendationUpdate(arg) {
  if (!(arg instanceof recommendations_pb.RecommendationUpdate)) {
    throw new Error('Expected argument of type homeflix.recommendations.RecommendationUpdate');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_RecommendationUpdate(buffer_arg) {
  return recommendations_pb.RecommendationUpdate.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_RefreshResponse(arg) {
  if (!(arg instanceof recommendations_pb.RefreshResponse)) {
    throw new Error('Expected argument of type homeflix.recommendations.RefreshResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_RefreshResponse(buffer_arg) {
  return recommendations_pb.RefreshResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_SimilarContentRequest(arg) {
  if (!(arg instanceof recommendations_pb.SimilarContentRequest)) {
    throw new Error('Expected argument of type homeflix.recommendations.SimilarContentRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_SimilarContentRequest(buffer_arg) {
  return recommendations_pb.SimilarContentRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_TrackClickRequest(arg) {
  if (!(arg instanceof recommendations_pb.TrackClickRequest)) {
    throw new Error('Expected argument of type homeflix.recommendations.TrackClickRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_TrackClickRequest(buffer_arg) {
  return recommendations_pb.TrackClickRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_TrackClickResponse(arg) {
  if (!(arg instanceof recommendations_pb.TrackClickResponse)) {
    throw new Error('Expected argument of type homeflix.recommendations.TrackClickResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_TrackClickResponse(buffer_arg) {
  return recommendations_pb.TrackClickResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_TrackViewRequest(arg) {
  if (!(arg instanceof recommendations_pb.TrackViewRequest)) {
    throw new Error('Expected argument of type homeflix.recommendations.TrackViewRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_TrackViewRequest(buffer_arg) {
  return recommendations_pb.TrackViewRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_TrackViewResponse(arg) {
  if (!(arg instanceof recommendations_pb.TrackViewResponse)) {
    throw new Error('Expected argument of type homeflix.recommendations.TrackViewResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_TrackViewResponse(buffer_arg) {
  return recommendations_pb.TrackViewResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_recommendations_TrendingRequest(arg) {
  if (!(arg instanceof recommendations_pb.TrendingRequest)) {
    throw new Error('Expected argument of type homeflix.recommendations.TrendingRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_recommendations_TrendingRequest(buffer_arg) {
  return recommendations_pb.TrendingRequest.deserializeBinary(new Uint8Array(buffer_arg));
}


// Recommendation Service
var RecommendationServiceService = exports.RecommendationServiceService = {
  // Get recommendations by category
getRecommendations: {
    path: '/homeflix.recommendations.RecommendationService/GetRecommendations',
    requestStream: false,
    responseStream: false,
    requestType: recommendations_pb.RecommendationRequest,
    responseType: recommendations_pb.RecommendationResponse,
    requestSerialize: serialize_homeflix_recommendations_RecommendationRequest,
    requestDeserialize: deserialize_homeflix_recommendations_RecommendationRequest,
    responseSerialize: serialize_homeflix_recommendations_RecommendationResponse,
    responseDeserialize: deserialize_homeflix_recommendations_RecommendationResponse,
  },
  // Real-time recommendation updates
watchRecommendations: {
    path: '/homeflix.recommendations.RecommendationService/WatchRecommendations',
    requestStream: false,
    responseStream: true,
    requestType: recommendations_pb.RecommendationRequest,
    responseType: recommendations_pb.RecommendationUpdate,
    requestSerialize: serialize_homeflix_recommendations_RecommendationRequest,
    requestDeserialize: deserialize_homeflix_recommendations_RecommendationRequest,
    responseSerialize: serialize_homeflix_recommendations_RecommendationUpdate,
    responseDeserialize: deserialize_homeflix_recommendations_RecommendationUpdate,
  },
  // Specific recommendation types
getTrendingRecommendations: {
    path: '/homeflix.recommendations.RecommendationService/GetTrendingRecommendations',
    requestStream: false,
    responseStream: false,
    requestType: recommendations_pb.TrendingRequest,
    responseType: recommendations_pb.RecommendationResponse,
    requestSerialize: serialize_homeflix_recommendations_TrendingRequest,
    requestDeserialize: deserialize_homeflix_recommendations_TrendingRequest,
    responseSerialize: serialize_homeflix_recommendations_RecommendationResponse,
    responseDeserialize: deserialize_homeflix_recommendations_RecommendationResponse,
  },
  getPersonalizedRecommendations: {
    path: '/homeflix.recommendations.RecommendationService/GetPersonalizedRecommendations',
    requestStream: false,
    responseStream: false,
    requestType: recommendations_pb.PersonalizedRequest,
    responseType: recommendations_pb.RecommendationResponse,
    requestSerialize: serialize_homeflix_recommendations_PersonalizedRequest,
    requestDeserialize: deserialize_homeflix_recommendations_PersonalizedRequest,
    responseSerialize: serialize_homeflix_recommendations_RecommendationResponse,
    responseDeserialize: deserialize_homeflix_recommendations_RecommendationResponse,
  },
  getSimilarContent: {
    path: '/homeflix.recommendations.RecommendationService/GetSimilarContent',
    requestStream: false,
    responseStream: false,
    requestType: recommendations_pb.SimilarContentRequest,
    responseType: recommendations_pb.RecommendationResponse,
    requestSerialize: serialize_homeflix_recommendations_SimilarContentRequest,
    requestDeserialize: deserialize_homeflix_recommendations_SimilarContentRequest,
    responseSerialize: serialize_homeflix_recommendations_RecommendationResponse,
    responseDeserialize: deserialize_homeflix_recommendations_RecommendationResponse,
  },
  getContinueWatching: {
    path: '/homeflix.recommendations.RecommendationService/GetContinueWatching',
    requestStream: false,
    responseStream: false,
    requestType: recommendations_pb.ContinueWatchingRequest,
    responseType: recommendations_pb.RecommendationResponse,
    requestSerialize: serialize_homeflix_recommendations_ContinueWatchingRequest,
    requestDeserialize: deserialize_homeflix_recommendations_ContinueWatchingRequest,
    responseSerialize: serialize_homeflix_recommendations_RecommendationResponse,
    responseDeserialize: deserialize_homeflix_recommendations_RecommendationResponse,
  },
  // Track user interactions
trackRecommendationClick: {
    path: '/homeflix.recommendations.RecommendationService/TrackRecommendationClick',
    requestStream: false,
    responseStream: false,
    requestType: recommendations_pb.TrackClickRequest,
    responseType: recommendations_pb.TrackClickResponse,
    requestSerialize: serialize_homeflix_recommendations_TrackClickRequest,
    requestDeserialize: deserialize_homeflix_recommendations_TrackClickRequest,
    responseSerialize: serialize_homeflix_recommendations_TrackClickResponse,
    responseDeserialize: deserialize_homeflix_recommendations_TrackClickResponse,
  },
  trackRecommendationView: {
    path: '/homeflix.recommendations.RecommendationService/TrackRecommendationView',
    requestStream: false,
    responseStream: false,
    requestType: recommendations_pb.TrackViewRequest,
    responseType: recommendations_pb.TrackViewResponse,
    requestSerialize: serialize_homeflix_recommendations_TrackViewRequest,
    requestDeserialize: deserialize_homeflix_recommendations_TrackViewRequest,
    responseSerialize: serialize_homeflix_recommendations_TrackViewResponse,
    responseDeserialize: deserialize_homeflix_recommendations_TrackViewResponse,
  },
  // Admin operations
refreshRecommendations: {
    path: '/homeflix.recommendations.RecommendationService/RefreshRecommendations',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: recommendations_pb.RefreshResponse,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_recommendations_RefreshResponse,
    responseDeserialize: deserialize_homeflix_recommendations_RefreshResponse,
  },
  generateRecommendations: {
    path: '/homeflix.recommendations.RecommendationService/GenerateRecommendations',
    requestStream: false,
    responseStream: false,
    requestType: recommendations_pb.GenerateRequest,
    responseType: recommendations_pb.GenerateResponse,
    requestSerialize: serialize_homeflix_recommendations_GenerateRequest,
    requestDeserialize: deserialize_homeflix_recommendations_GenerateRequest,
    responseSerialize: serialize_homeflix_recommendations_GenerateResponse,
    responseDeserialize: deserialize_homeflix_recommendations_GenerateResponse,
  },
};

exports.RecommendationServiceClient = grpc.makeGenericClientConstructor(RecommendationServiceService, 'RecommendationService');

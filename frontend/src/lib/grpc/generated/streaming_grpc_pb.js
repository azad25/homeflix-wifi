// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var streaming_pb = require('./streaming_pb.js');
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

function serialize_homeflix_streaming_ALACMetadata(arg) {
  if (!(arg instanceof streaming_pb.ALACMetadata)) {
    throw new Error('Expected argument of type homeflix.streaming.ALACMetadata');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_ALACMetadata(buffer_arg) {
  return streaming_pb.ALACMetadata.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_ALACRequest(arg) {
  if (!(arg instanceof streaming_pb.ALACRequest)) {
    throw new Error('Expected argument of type homeflix.streaming.ALACRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_ALACRequest(buffer_arg) {
  return streaming_pb.ALACRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_ExtractALACRequest(arg) {
  if (!(arg instanceof streaming_pb.ExtractALACRequest)) {
    throw new Error('Expected argument of type homeflix.streaming.ExtractALACRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_ExtractALACRequest(buffer_arg) {
  return streaming_pb.ExtractALACRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_ExtractALACResponse(arg) {
  if (!(arg instanceof streaming_pb.ExtractALACResponse)) {
    throw new Error('Expected argument of type homeflix.streaming.ExtractALACResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_ExtractALACResponse(buffer_arg) {
  return streaming_pb.ExtractALACResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_PlaybackCommand(arg) {
  if (!(arg instanceof streaming_pb.PlaybackCommand)) {
    throw new Error('Expected argument of type homeflix.streaming.PlaybackCommand');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_PlaybackCommand(buffer_arg) {
  return streaming_pb.PlaybackCommand.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_PlaybackStatus(arg) {
  if (!(arg instanceof streaming_pb.PlaybackStatus)) {
    throw new Error('Expected argument of type homeflix.streaming.PlaybackStatus');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_PlaybackStatus(buffer_arg) {
  return streaming_pb.PlaybackStatus.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_ProgressResponse(arg) {
  if (!(arg instanceof streaming_pb.ProgressResponse)) {
    throw new Error('Expected argument of type homeflix.streaming.ProgressResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_ProgressResponse(buffer_arg) {
  return streaming_pb.ProgressResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_ProgressUpdate(arg) {
  if (!(arg instanceof streaming_pb.ProgressUpdate)) {
    throw new Error('Expected argument of type homeflix.streaming.ProgressUpdate');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_ProgressUpdate(buffer_arg) {
  return streaming_pb.ProgressUpdate.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_SpatialAudioRequest(arg) {
  if (!(arg instanceof streaming_pb.SpatialAudioRequest)) {
    throw new Error('Expected argument of type homeflix.streaming.SpatialAudioRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_SpatialAudioRequest(buffer_arg) {
  return streaming_pb.SpatialAudioRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_SpatialAudioResponse(arg) {
  if (!(arg instanceof streaming_pb.SpatialAudioResponse)) {
    throw new Error('Expected argument of type homeflix.streaming.SpatialAudioResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_SpatialAudioResponse(buffer_arg) {
  return streaming_pb.SpatialAudioResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_StreamChunk(arg) {
  if (!(arg instanceof streaming_pb.StreamChunk)) {
    throw new Error('Expected argument of type homeflix.streaming.StreamChunk');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_StreamChunk(buffer_arg) {
  return streaming_pb.StreamChunk.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_StreamRequest(arg) {
  if (!(arg instanceof streaming_pb.StreamRequest)) {
    throw new Error('Expected argument of type homeflix.streaming.StreamRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_StreamRequest(buffer_arg) {
  return streaming_pb.StreamRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_SubtitleChunk(arg) {
  if (!(arg instanceof streaming_pb.SubtitleChunk)) {
    throw new Error('Expected argument of type homeflix.streaming.SubtitleChunk');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_SubtitleChunk(buffer_arg) {
  return streaming_pb.SubtitleChunk.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_SubtitleRequest(arg) {
  if (!(arg instanceof streaming_pb.SubtitleRequest)) {
    throw new Error('Expected argument of type homeflix.streaming.SubtitleRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_SubtitleRequest(buffer_arg) {
  return streaming_pb.SubtitleRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_streaming_SupportedFormatsResponse(arg) {
  if (!(arg instanceof streaming_pb.SupportedFormatsResponse)) {
    throw new Error('Expected argument of type homeflix.streaming.SupportedFormatsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_streaming_SupportedFormatsResponse(buffer_arg) {
  return streaming_pb.SupportedFormatsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


// Streaming Service for video/audio content
var StreamingServiceService = exports.StreamingServiceService = {
  // Video streaming with chunked responses
streamVideo: {
    path: '/homeflix.streaming.StreamingService/StreamVideo',
    requestStream: false,
    responseStream: true,
    requestType: streaming_pb.StreamRequest,
    responseType: streaming_pb.StreamChunk,
    requestSerialize: serialize_homeflix_streaming_StreamRequest,
    requestDeserialize: deserialize_homeflix_streaming_StreamRequest,
    responseSerialize: serialize_homeflix_streaming_StreamChunk,
    responseDeserialize: deserialize_homeflix_streaming_StreamChunk,
  },
  // Audio streaming (including ALAC)
streamAudio: {
    path: '/homeflix.streaming.StreamingService/StreamAudio',
    requestStream: false,
    responseStream: true,
    requestType: streaming_pb.StreamRequest,
    responseType: streaming_pb.StreamChunk,
    requestSerialize: serialize_homeflix_streaming_StreamRequest,
    requestDeserialize: deserialize_homeflix_streaming_StreamRequest,
    responseSerialize: serialize_homeflix_streaming_StreamChunk,
    responseDeserialize: deserialize_homeflix_streaming_StreamChunk,
  },
  // Preview clips
streamPreviewClip: {
    path: '/homeflix.streaming.StreamingService/StreamPreviewClip',
    requestStream: false,
    responseStream: true,
    requestType: streaming_pb.StreamRequest,
    responseType: streaming_pb.StreamChunk,
    requestSerialize: serialize_homeflix_streaming_StreamRequest,
    requestDeserialize: deserialize_homeflix_streaming_StreamRequest,
    responseSerialize: serialize_homeflix_streaming_StreamChunk,
    responseDeserialize: deserialize_homeflix_streaming_StreamChunk,
  },
  // Subtitle streaming
streamSubtitles: {
    path: '/homeflix.streaming.StreamingService/StreamSubtitles',
    requestStream: false,
    responseStream: true,
    requestType: streaming_pb.SubtitleRequest,
    responseType: streaming_pb.SubtitleChunk,
    requestSerialize: serialize_homeflix_streaming_SubtitleRequest,
    requestDeserialize: deserialize_homeflix_streaming_SubtitleRequest,
    responseSerialize: serialize_homeflix_streaming_SubtitleChunk,
    responseDeserialize: deserialize_homeflix_streaming_SubtitleChunk,
  },
  // Bidirectional streaming for playback control
playbackSession: {
    path: '/homeflix.streaming.StreamingService/PlaybackSession',
    requestStream: true,
    responseStream: true,
    requestType: streaming_pb.PlaybackCommand,
    responseType: streaming_pb.PlaybackStatus,
    requestSerialize: serialize_homeflix_streaming_PlaybackCommand,
    requestDeserialize: deserialize_homeflix_streaming_PlaybackCommand,
    responseSerialize: serialize_homeflix_streaming_PlaybackStatus,
    responseDeserialize: deserialize_homeflix_streaming_PlaybackStatus,
  },
  // Real-time progress tracking
trackProgress: {
    path: '/homeflix.streaming.StreamingService/TrackProgress',
    requestStream: true,
    responseStream: true,
    requestType: streaming_pb.ProgressUpdate,
    responseType: streaming_pb.ProgressResponse,
    requestSerialize: serialize_homeflix_streaming_ProgressUpdate,
    requestDeserialize: deserialize_homeflix_streaming_ProgressUpdate,
    responseSerialize: serialize_homeflix_streaming_ProgressResponse,
    responseDeserialize: deserialize_homeflix_streaming_ProgressResponse,
  },
};

exports.StreamingServiceClient = grpc.makeGenericClientConstructor(StreamingServiceService, 'StreamingService');
// ALAC Audio Service
var ALACAudioServiceService = exports.ALACAudioServiceService = {
  getALACAudio: {
    path: '/homeflix.streaming.ALACAudioService/GetALACAudio',
    requestStream: false,
    responseStream: true,
    requestType: streaming_pb.ALACRequest,
    responseType: streaming_pb.StreamChunk,
    requestSerialize: serialize_homeflix_streaming_ALACRequest,
    requestDeserialize: deserialize_homeflix_streaming_ALACRequest,
    responseSerialize: serialize_homeflix_streaming_StreamChunk,
    responseDeserialize: deserialize_homeflix_streaming_StreamChunk,
  },
  extractALACAudio: {
    path: '/homeflix.streaming.ALACAudioService/ExtractALACAudio',
    requestStream: false,
    responseStream: false,
    requestType: streaming_pb.ExtractALACRequest,
    responseType: streaming_pb.ExtractALACResponse,
    requestSerialize: serialize_homeflix_streaming_ExtractALACRequest,
    requestDeserialize: deserialize_homeflix_streaming_ExtractALACRequest,
    responseSerialize: serialize_homeflix_streaming_ExtractALACResponse,
    responseDeserialize: deserialize_homeflix_streaming_ExtractALACResponse,
  },
  getALACMetadata: {
    path: '/homeflix.streaming.ALACAudioService/GetALACMetadata',
    requestStream: false,
    responseStream: false,
    requestType: streaming_pb.ALACRequest,
    responseType: streaming_pb.ALACMetadata,
    requestSerialize: serialize_homeflix_streaming_ALACRequest,
    requestDeserialize: deserialize_homeflix_streaming_ALACRequest,
    responseSerialize: serialize_homeflix_streaming_ALACMetadata,
    responseDeserialize: deserialize_homeflix_streaming_ALACMetadata,
  },
  convertToSpatialAudio: {
    path: '/homeflix.streaming.ALACAudioService/ConvertToSpatialAudio',
    requestStream: false,
    responseStream: false,
    requestType: streaming_pb.SpatialAudioRequest,
    responseType: streaming_pb.SpatialAudioResponse,
    requestSerialize: serialize_homeflix_streaming_SpatialAudioRequest,
    requestDeserialize: deserialize_homeflix_streaming_SpatialAudioRequest,
    responseSerialize: serialize_homeflix_streaming_SpatialAudioResponse,
    responseDeserialize: deserialize_homeflix_streaming_SpatialAudioResponse,
  },
  getSupportedFormats: {
    path: '/homeflix.streaming.ALACAudioService/GetSupportedFormats',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: streaming_pb.SupportedFormatsResponse,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_streaming_SupportedFormatsResponse,
    responseDeserialize: deserialize_homeflix_streaming_SupportedFormatsResponse,
  },
  getAudioFileInfo: {
    path: '/homeflix.streaming.ALACAudioService/GetAudioFileInfo',
    requestStream: false,
    responseStream: false,
    requestType: streaming_pb.ALACRequest,
    responseType: streaming_pb.ALACMetadata,
    requestSerialize: serialize_homeflix_streaming_ALACRequest,
    requestDeserialize: deserialize_homeflix_streaming_ALACRequest,
    responseSerialize: serialize_homeflix_streaming_ALACMetadata,
    responseDeserialize: deserialize_homeflix_streaming_ALACMetadata,
  },
};

exports.ALACAudioServiceClient = grpc.makeGenericClientConstructor(ALACAudioServiceService, 'ALACAudioService');

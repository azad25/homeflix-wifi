// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var admin_pb = require('./admin_pb.js');
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

function serialize_homeflix_admin_AssetProgress(arg) {
  if (!(arg instanceof admin_pb.AssetProgress)) {
    throw new Error('Expected argument of type homeflix.admin.AssetProgress');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_AssetProgress(buffer_arg) {
  return admin_pb.AssetProgress.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_AssetRequest(arg) {
  if (!(arg instanceof admin_pb.AssetRequest)) {
    throw new Error('Expected argument of type homeflix.admin.AssetRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_AssetRequest(buffer_arg) {
  return admin_pb.AssetRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_FileEvent(arg) {
  if (!(arg instanceof admin_pb.FileEvent)) {
    throw new Error('Expected argument of type homeflix.admin.FileEvent');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_FileEvent(buffer_arg) {
  return admin_pb.FileEvent.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_GenerateMetadataRequest(arg) {
  if (!(arg instanceof admin_pb.GenerateMetadataRequest)) {
    throw new Error('Expected argument of type homeflix.admin.GenerateMetadataRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_GenerateMetadataRequest(buffer_arg) {
  return admin_pb.GenerateMetadataRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_HealthUpdate(arg) {
  if (!(arg instanceof admin_pb.HealthUpdate)) {
    throw new Error('Expected argument of type homeflix.admin.HealthUpdate');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_HealthUpdate(buffer_arg) {
  return admin_pb.HealthUpdate.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_MetadataProgress(arg) {
  if (!(arg instanceof admin_pb.MetadataProgress)) {
    throw new Error('Expected argument of type homeflix.admin.MetadataProgress');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_MetadataProgress(buffer_arg) {
  return admin_pb.MetadataProgress.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_PurgeQueueRequest(arg) {
  if (!(arg instanceof admin_pb.PurgeQueueRequest)) {
    throw new Error('Expected argument of type homeflix.admin.PurgeQueueRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_PurgeQueueRequest(buffer_arg) {
  return admin_pb.PurgeQueueRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_PurgeQueueResponse(arg) {
  if (!(arg instanceof admin_pb.PurgeQueueResponse)) {
    throw new Error('Expected argument of type homeflix.admin.PurgeQueueResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_PurgeQueueResponse(buffer_arg) {
  return admin_pb.PurgeQueueResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_QueueMetrics(arg) {
  if (!(arg instanceof admin_pb.QueueMetrics)) {
    throw new Error('Expected argument of type homeflix.admin.QueueMetrics');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_QueueMetrics(buffer_arg) {
  return admin_pb.QueueMetrics.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_QueueStatusResponse(arg) {
  if (!(arg instanceof admin_pb.QueueStatusResponse)) {
    throw new Error('Expected argument of type homeflix.admin.QueueStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_QueueStatusResponse(buffer_arg) {
  return admin_pb.QueueStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_ScanProgress(arg) {
  if (!(arg instanceof admin_pb.ScanProgress)) {
    throw new Error('Expected argument of type homeflix.admin.ScanProgress');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_ScanProgress(buffer_arg) {
  return admin_pb.ScanProgress.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_ScanRequest(arg) {
  if (!(arg instanceof admin_pb.ScanRequest)) {
    throw new Error('Expected argument of type homeflix.admin.ScanRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_ScanRequest(buffer_arg) {
  return admin_pb.ScanRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_ScanStats(arg) {
  if (!(arg instanceof admin_pb.ScanStats)) {
    throw new Error('Expected argument of type homeflix.admin.ScanStats');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_ScanStats(buffer_arg) {
  return admin_pb.ScanStats.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_SystemStats(arg) {
  if (!(arg instanceof admin_pb.SystemStats)) {
    throw new Error('Expected argument of type homeflix.admin.SystemStats');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_SystemStats(buffer_arg) {
  return admin_pb.SystemStats.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_TMDBUpdateRequest(arg) {
  if (!(arg instanceof admin_pb.TMDBUpdateRequest)) {
    throw new Error('Expected argument of type homeflix.admin.TMDBUpdateRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_TMDBUpdateRequest(buffer_arg) {
  return admin_pb.TMDBUpdateRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_TMDBUpdateResponse(arg) {
  if (!(arg instanceof admin_pb.TMDBUpdateResponse)) {
    throw new Error('Expected argument of type homeflix.admin.TMDBUpdateResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_TMDBUpdateResponse(buffer_arg) {
  return admin_pb.TMDBUpdateResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_UpdateMetadataRequest(arg) {
  if (!(arg instanceof admin_pb.UpdateMetadataRequest)) {
    throw new Error('Expected argument of type homeflix.admin.UpdateMetadataRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_UpdateMetadataRequest(buffer_arg) {
  return admin_pb.UpdateMetadataRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_UpdateMetadataResponse(arg) {
  if (!(arg instanceof admin_pb.UpdateMetadataResponse)) {
    throw new Error('Expected argument of type homeflix.admin.UpdateMetadataResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_UpdateMetadataResponse(buffer_arg) {
  return admin_pb.UpdateMetadataResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_WatcherRequest(arg) {
  if (!(arg instanceof admin_pb.WatcherRequest)) {
    throw new Error('Expected argument of type homeflix.admin.WatcherRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_WatcherRequest(buffer_arg) {
  return admin_pb.WatcherRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_WatcherResponse(arg) {
  if (!(arg instanceof admin_pb.WatcherResponse)) {
    throw new Error('Expected argument of type homeflix.admin.WatcherResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_WatcherResponse(buffer_arg) {
  return admin_pb.WatcherResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_homeflix_admin_WatcherStatus(arg) {
  if (!(arg instanceof admin_pb.WatcherStatus)) {
    throw new Error('Expected argument of type homeflix.admin.WatcherStatus');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_homeflix_admin_WatcherStatus(buffer_arg) {
  return admin_pb.WatcherStatus.deserializeBinary(new Uint8Array(buffer_arg));
}


// Admin Service for system management
var AdminServiceService = exports.AdminServiceService = {
  // Media scanning with real-time progress
startFullScan: {
    path: '/homeflix.admin.AdminService/StartFullScan',
    requestStream: false,
    responseStream: true,
    requestType: admin_pb.ScanRequest,
    responseType: admin_pb.ScanProgress,
    requestSerialize: serialize_homeflix_admin_ScanRequest,
    requestDeserialize: deserialize_homeflix_admin_ScanRequest,
    responseSerialize: serialize_homeflix_admin_ScanProgress,
    responseDeserialize: deserialize_homeflix_admin_ScanProgress,
  },
  startIncrementalScan: {
    path: '/homeflix.admin.AdminService/StartIncrementalScan',
    requestStream: false,
    responseStream: true,
    requestType: admin_pb.ScanRequest,
    responseType: admin_pb.ScanProgress,
    requestSerialize: serialize_homeflix_admin_ScanRequest,
    requestDeserialize: deserialize_homeflix_admin_ScanRequest,
    responseSerialize: serialize_homeflix_admin_ScanProgress,
    responseDeserialize: deserialize_homeflix_admin_ScanProgress,
  },
  startSuperfastScan: {
    path: '/homeflix.admin.AdminService/StartSuperfastScan',
    requestStream: false,
    responseStream: true,
    requestType: admin_pb.ScanRequest,
    responseType: admin_pb.ScanProgress,
    requestSerialize: serialize_homeflix_admin_ScanRequest,
    requestDeserialize: deserialize_homeflix_admin_ScanRequest,
    responseSerialize: serialize_homeflix_admin_ScanProgress,
    responseDeserialize: deserialize_homeflix_admin_ScanProgress,
  },
  getScanStats: {
    path: '/homeflix.admin.AdminService/GetScanStats',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: admin_pb.ScanStats,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_admin_ScanStats,
    responseDeserialize: deserialize_homeflix_admin_ScanStats,
  },
  // Asset management with progress streaming
generateThumbnails: {
    path: '/homeflix.admin.AdminService/GenerateThumbnails',
    requestStream: false,
    responseStream: true,
    requestType: admin_pb.AssetRequest,
    responseType: admin_pb.AssetProgress,
    requestSerialize: serialize_homeflix_admin_AssetRequest,
    requestDeserialize: deserialize_homeflix_admin_AssetRequest,
    responseSerialize: serialize_homeflix_admin_AssetProgress,
    responseDeserialize: deserialize_homeflix_admin_AssetProgress,
  },
  generatePreviewClips: {
    path: '/homeflix.admin.AdminService/GeneratePreviewClips',
    requestStream: false,
    responseStream: true,
    requestType: admin_pb.AssetRequest,
    responseType: admin_pb.AssetProgress,
    requestSerialize: serialize_homeflix_admin_AssetRequest,
    requestDeserialize: deserialize_homeflix_admin_AssetRequest,
    responseSerialize: serialize_homeflix_admin_AssetProgress,
    responseDeserialize: deserialize_homeflix_admin_AssetProgress,
  },
  regenerateAssets: {
    path: '/homeflix.admin.AdminService/RegenerateAssets',
    requestStream: false,
    responseStream: true,
    requestType: admin_pb.AssetRequest,
    responseType: admin_pb.AssetProgress,
    requestSerialize: serialize_homeflix_admin_AssetRequest,
    requestDeserialize: deserialize_homeflix_admin_AssetRequest,
    responseSerialize: serialize_homeflix_admin_AssetProgress,
    responseDeserialize: deserialize_homeflix_admin_AssetProgress,
  },
  // File watcher management
startFileWatcher: {
    path: '/homeflix.admin.AdminService/StartFileWatcher',
    requestStream: false,
    responseStream: false,
    requestType: admin_pb.WatcherRequest,
    responseType: admin_pb.WatcherResponse,
    requestSerialize: serialize_homeflix_admin_WatcherRequest,
    requestDeserialize: deserialize_homeflix_admin_WatcherRequest,
    responseSerialize: serialize_homeflix_admin_WatcherResponse,
    responseDeserialize: deserialize_homeflix_admin_WatcherResponse,
  },
  stopFileWatcher: {
    path: '/homeflix.admin.AdminService/StopFileWatcher',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: admin_pb.WatcherResponse,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_admin_WatcherResponse,
    responseDeserialize: deserialize_homeflix_admin_WatcherResponse,
  },
  getWatcherStatus: {
    path: '/homeflix.admin.AdminService/GetWatcherStatus',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: admin_pb.WatcherStatus,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_admin_WatcherStatus,
    responseDeserialize: deserialize_homeflix_admin_WatcherStatus,
  },
  watchFileEvents: {
    path: '/homeflix.admin.AdminService/WatchFileEvents',
    requestStream: false,
    responseStream: true,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: admin_pb.FileEvent,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_admin_FileEvent,
    responseDeserialize: deserialize_homeflix_admin_FileEvent,
  },
  // System monitoring
getSystemStats: {
    path: '/homeflix.admin.AdminService/GetSystemStats',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: admin_pb.SystemStats,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_admin_SystemStats,
    responseDeserialize: deserialize_homeflix_admin_SystemStats,
  },
  watchSystemHealth: {
    path: '/homeflix.admin.AdminService/WatchSystemHealth',
    requestStream: false,
    responseStream: true,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: admin_pb.HealthUpdate,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_admin_HealthUpdate,
    responseDeserialize: deserialize_homeflix_admin_HealthUpdate,
  },
  // Task queue management
getQueueStatus: {
    path: '/homeflix.admin.AdminService/GetQueueStatus',
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: admin_pb.QueueStatusResponse,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_admin_QueueStatusResponse,
    responseDeserialize: deserialize_homeflix_admin_QueueStatusResponse,
  },
  purgeQueue: {
    path: '/homeflix.admin.AdminService/PurgeQueue',
    requestStream: false,
    responseStream: false,
    requestType: admin_pb.PurgeQueueRequest,
    responseType: admin_pb.PurgeQueueResponse,
    requestSerialize: serialize_homeflix_admin_PurgeQueueRequest,
    requestDeserialize: deserialize_homeflix_admin_PurgeQueueRequest,
    responseSerialize: serialize_homeflix_admin_PurgeQueueResponse,
    responseDeserialize: deserialize_homeflix_admin_PurgeQueueResponse,
  },
  watchQueueMetrics: {
    path: '/homeflix.admin.AdminService/WatchQueueMetrics',
    requestStream: false,
    responseStream: true,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: admin_pb.QueueMetrics,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_homeflix_admin_QueueMetrics,
    responseDeserialize: deserialize_homeflix_admin_QueueMetrics,
  },
  // Metadata management
updateMediaMetadata: {
    path: '/homeflix.admin.AdminService/UpdateMediaMetadata',
    requestStream: false,
    responseStream: false,
    requestType: admin_pb.UpdateMetadataRequest,
    responseType: admin_pb.UpdateMetadataResponse,
    requestSerialize: serialize_homeflix_admin_UpdateMetadataRequest,
    requestDeserialize: deserialize_homeflix_admin_UpdateMetadataRequest,
    responseSerialize: serialize_homeflix_admin_UpdateMetadataResponse,
    responseDeserialize: deserialize_homeflix_admin_UpdateMetadataResponse,
  },
  generateAIMetadata: {
    path: '/homeflix.admin.AdminService/GenerateAIMetadata',
    requestStream: false,
    responseStream: true,
    requestType: admin_pb.GenerateMetadataRequest,
    responseType: admin_pb.MetadataProgress,
    requestSerialize: serialize_homeflix_admin_GenerateMetadataRequest,
    requestDeserialize: deserialize_homeflix_admin_GenerateMetadataRequest,
    responseSerialize: serialize_homeflix_admin_MetadataProgress,
    responseDeserialize: deserialize_homeflix_admin_MetadataProgress,
  },
  updateWithTMDB: {
    path: '/homeflix.admin.AdminService/UpdateWithTMDB',
    requestStream: false,
    responseStream: false,
    requestType: admin_pb.TMDBUpdateRequest,
    responseType: admin_pb.TMDBUpdateResponse,
    requestSerialize: serialize_homeflix_admin_TMDBUpdateRequest,
    requestDeserialize: deserialize_homeflix_admin_TMDBUpdateRequest,
    responseSerialize: serialize_homeflix_admin_TMDBUpdateResponse,
    responseDeserialize: deserialize_homeflix_admin_TMDBUpdateResponse,
  },
};

exports.AdminServiceClient = grpc.makeGenericClientConstructor(AdminServiceService, 'AdminService');

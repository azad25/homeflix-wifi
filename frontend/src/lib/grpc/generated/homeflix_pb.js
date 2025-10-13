// source: homeflix.proto
/**
 * @fileoverview
 * @enhanceable
 * @suppress {missingRequire} reports error on implicit type usages.
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!
/* eslint-disable */
// @ts-nocheck

var jspb = require('google-protobuf');
var goog = jspb;
var global = (function() {
  if (this) { return this; }
  if (typeof window !== 'undefined') { return window; }
  if (typeof global !== 'undefined') { return global; }
  if (typeof self !== 'undefined') { return self; }
  return Function('return this')();
}.call(null));

var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');
goog.object.extend(proto, google_protobuf_timestamp_pb);
var google_protobuf_empty_pb = require('google-protobuf/google/protobuf/empty_pb.js');
goog.object.extend(proto, google_protobuf_empty_pb);
goog.exportSymbol('proto.homeflix.AdminPreviewQueue', null, global);
goog.exportSymbol('proto.homeflix.AudioTrack', null, global);
goog.exportSymbol('proto.homeflix.DeleteUserRequest', null, global);
goog.exportSymbol('proto.homeflix.Episode', null, global);
goog.exportSymbol('proto.homeflix.GeneratePreviewRequest', null, global);
goog.exportSymbol('proto.homeflix.GeneratePreviewResponse', null, global);
goog.exportSymbol('proto.homeflix.GetAllUsersRequest', null, global);
goog.exportSymbol('proto.homeflix.GetAllUsersResponse', null, global);
goog.exportSymbol('proto.homeflix.GetByGenreRequest', null, global);
goog.exportSymbol('proto.homeflix.GetMovieRequest', null, global);
goog.exportSymbol('proto.homeflix.GetMoviesRequest', null, global);
goog.exportSymbol('proto.homeflix.GetMoviesResponse', null, global);
goog.exportSymbol('proto.homeflix.GetRecentRequest', null, global);
goog.exportSymbol('proto.homeflix.GetSeriesDetailsRequest', null, global);
goog.exportSymbol('proto.homeflix.GetSeriesRequest', null, global);
goog.exportSymbol('proto.homeflix.GetSeriesResponse', null, global);
goog.exportSymbol('proto.homeflix.GetUserPreferencesRequest', null, global);
goog.exportSymbol('proto.homeflix.GetWatchHistoryRequest', null, global);
goog.exportSymbol('proto.homeflix.GetWatchHistoryResponse', null, global);
goog.exportSymbol('proto.homeflix.LoginRequest', null, global);
goog.exportSymbol('proto.homeflix.LoginResponse', null, global);
goog.exportSymbol('proto.homeflix.MediaListResponse', null, global);
goog.exportSymbol('proto.homeflix.Movie', null, global);
goog.exportSymbol('proto.homeflix.PlaybackCommand', null, global);
goog.exportSymbol('proto.homeflix.PlaybackState', null, global);
goog.exportSymbol('proto.homeflix.PlaybackStateRequest', null, global);
goog.exportSymbol('proto.homeflix.PlaybackStatus', null, global);
goog.exportSymbol('proto.homeflix.PreviewJob', null, global);
goog.exportSymbol('proto.homeflix.PreviewProgress', null, global);
goog.exportSymbol('proto.homeflix.PreviewProgressRequest', null, global);
goog.exportSymbol('proto.homeflix.PreviewQueueStatus', null, global);
goog.exportSymbol('proto.homeflix.PreviewRequest', null, global);
goog.exportSymbol('proto.homeflix.PreviewStatus', null, global);
goog.exportSymbol('proto.homeflix.PreviewStatusRequest', null, global);
goog.exportSymbol('proto.homeflix.RateMediaRequest', null, global);
goog.exportSymbol('proto.homeflix.RateMediaResponse', null, global);
goog.exportSymbol('proto.homeflix.RecommendationItem', null, global);
goog.exportSymbol('proto.homeflix.RecommendationRequest', null, global);
goog.exportSymbol('proto.homeflix.RecommendationResponse', null, global);
goog.exportSymbol('proto.homeflix.RecommendationStreamRequest', null, global);
goog.exportSymbol('proto.homeflix.RecommendationUpdate', null, global);
goog.exportSymbol('proto.homeflix.RefreshTokenRequest', null, global);
goog.exportSymbol('proto.homeflix.RefreshTokenResponse', null, global);
goog.exportSymbol('proto.homeflix.RegisterRequest', null, global);
goog.exportSymbol('proto.homeflix.RegisterResponse', null, global);
goog.exportSymbol('proto.homeflix.ScanLibraryRequest', null, global);
goog.exportSymbol('proto.homeflix.ScanProgress', null, global);
goog.exportSymbol('proto.homeflix.ScanStatus', null, global);
goog.exportSymbol('proto.homeflix.SearchRequest', null, global);
goog.exportSymbol('proto.homeflix.SearchResponse', null, global);
goog.exportSymbol('proto.homeflix.Season', null, global);
goog.exportSymbol('proto.homeflix.Series', null, global);
goog.exportSymbol('proto.homeflix.SimilarMediaRequest', null, global);
goog.exportSymbol('proto.homeflix.StreamChunk', null, global);
goog.exportSymbol('proto.homeflix.StreamInfo', null, global);
goog.exportSymbol('proto.homeflix.StreamInfoRequest', null, global);
goog.exportSymbol('proto.homeflix.StreamRequest', null, global);
goog.exportSymbol('proto.homeflix.StreamingMetrics', null, global);
goog.exportSymbol('proto.homeflix.StreamingSession', null, global);
goog.exportSymbol('proto.homeflix.SubtitleTrack', null, global);
goog.exportSymbol('proto.homeflix.SyncPlaybackRequest', null, global);
goog.exportSymbol('proto.homeflix.SyncPlaybackResponse', null, global);
goog.exportSymbol('proto.homeflix.SystemHealth', null, global);
goog.exportSymbol('proto.homeflix.UpdateUserPreferencesRequest', null, global);
goog.exportSymbol('proto.homeflix.UpdateWatchProgressRequest', null, global);
goog.exportSymbol('proto.homeflix.User', null, global);
goog.exportSymbol('proto.homeflix.UserPreferences', null, global);
goog.exportSymbol('proto.homeflix.WatchHistoryItem', null, global);
goog.exportSymbol('proto.homeflix.WatchProgress', null, global);
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.Movie = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.Movie.repeatedFields_, null);
};
goog.inherits(proto.homeflix.Movie, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.Movie.displayName = 'proto.homeflix.Movie';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.Series = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.Series.repeatedFields_, null);
};
goog.inherits(proto.homeflix.Series, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.Series.displayName = 'proto.homeflix.Series';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.Season = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.Season.repeatedFields_, null);
};
goog.inherits(proto.homeflix.Season, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.Season.displayName = 'proto.homeflix.Season';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.Episode = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.Episode.repeatedFields_, null);
};
goog.inherits(proto.homeflix.Episode, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.Episode.displayName = 'proto.homeflix.Episode';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetMoviesRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.GetMoviesRequest.repeatedFields_, null);
};
goog.inherits(proto.homeflix.GetMoviesRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetMoviesRequest.displayName = 'proto.homeflix.GetMoviesRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetMoviesResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.GetMoviesResponse.repeatedFields_, null);
};
goog.inherits(proto.homeflix.GetMoviesResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetMoviesResponse.displayName = 'proto.homeflix.GetMoviesResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetMovieRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.GetMovieRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetMovieRequest.displayName = 'proto.homeflix.GetMovieRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetSeriesRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.GetSeriesRequest.repeatedFields_, null);
};
goog.inherits(proto.homeflix.GetSeriesRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetSeriesRequest.displayName = 'proto.homeflix.GetSeriesRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetSeriesResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.GetSeriesResponse.repeatedFields_, null);
};
goog.inherits(proto.homeflix.GetSeriesResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetSeriesResponse.displayName = 'proto.homeflix.GetSeriesResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetSeriesDetailsRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.GetSeriesDetailsRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetSeriesDetailsRequest.displayName = 'proto.homeflix.GetSeriesDetailsRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.SearchRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.SearchRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.SearchRequest.displayName = 'proto.homeflix.SearchRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.SearchResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.SearchResponse.repeatedFields_, null);
};
goog.inherits(proto.homeflix.SearchResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.SearchResponse.displayName = 'proto.homeflix.SearchResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetByGenreRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.GetByGenreRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetByGenreRequest.displayName = 'proto.homeflix.GetByGenreRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetRecentRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.GetRecentRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetRecentRequest.displayName = 'proto.homeflix.GetRecentRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.MediaListResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.MediaListResponse.repeatedFields_, null);
};
goog.inherits(proto.homeflix.MediaListResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.MediaListResponse.displayName = 'proto.homeflix.MediaListResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.StreamRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.StreamRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.StreamRequest.displayName = 'proto.homeflix.StreamRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.StreamChunk = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.StreamChunk, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.StreamChunk.displayName = 'proto.homeflix.StreamChunk';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.StreamInfoRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.StreamInfoRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.StreamInfoRequest.displayName = 'proto.homeflix.StreamInfoRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.StreamInfo = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.StreamInfo.repeatedFields_, null);
};
goog.inherits(proto.homeflix.StreamInfo, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.StreamInfo.displayName = 'proto.homeflix.StreamInfo';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.AudioTrack = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.AudioTrack, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.AudioTrack.displayName = 'proto.homeflix.AudioTrack';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.SubtitleTrack = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.SubtitleTrack, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.SubtitleTrack.displayName = 'proto.homeflix.SubtitleTrack';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PreviewRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.PreviewRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PreviewRequest.displayName = 'proto.homeflix.PreviewRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GeneratePreviewRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.GeneratePreviewRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GeneratePreviewRequest.displayName = 'proto.homeflix.GeneratePreviewRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GeneratePreviewResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.GeneratePreviewResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GeneratePreviewResponse.displayName = 'proto.homeflix.GeneratePreviewResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PreviewStatusRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.PreviewStatusRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PreviewStatusRequest.displayName = 'proto.homeflix.PreviewStatusRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PreviewStatus = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.PreviewStatus, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PreviewStatus.displayName = 'proto.homeflix.PreviewStatus';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PreviewProgressRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.PreviewProgressRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PreviewProgressRequest.displayName = 'proto.homeflix.PreviewProgressRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PreviewProgress = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.PreviewProgress, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PreviewProgress.displayName = 'proto.homeflix.PreviewProgress';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PreviewQueueStatus = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.PreviewQueueStatus.repeatedFields_, null);
};
goog.inherits(proto.homeflix.PreviewQueueStatus, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PreviewQueueStatus.displayName = 'proto.homeflix.PreviewQueueStatus';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PreviewJob = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.PreviewJob, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PreviewJob.displayName = 'proto.homeflix.PreviewJob';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.LoginRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.LoginRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.LoginRequest.displayName = 'proto.homeflix.LoginRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.LoginResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.LoginResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.LoginResponse.displayName = 'proto.homeflix.LoginResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RegisterRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.RegisterRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RegisterRequest.displayName = 'proto.homeflix.RegisterRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RegisterResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.RegisterResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RegisterResponse.displayName = 'proto.homeflix.RegisterResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RefreshTokenRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.RefreshTokenRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RefreshTokenRequest.displayName = 'proto.homeflix.RefreshTokenRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RefreshTokenResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.RefreshTokenResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RefreshTokenResponse.displayName = 'proto.homeflix.RefreshTokenResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.User = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.User, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.User.displayName = 'proto.homeflix.User';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetUserPreferencesRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.GetUserPreferencesRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetUserPreferencesRequest.displayName = 'proto.homeflix.GetUserPreferencesRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.UpdateUserPreferencesRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.UpdateUserPreferencesRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.UpdateUserPreferencesRequest.displayName = 'proto.homeflix.UpdateUserPreferencesRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.UserPreferences = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.UserPreferences.repeatedFields_, null);
};
goog.inherits(proto.homeflix.UserPreferences, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.UserPreferences.displayName = 'proto.homeflix.UserPreferences';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.UpdateWatchProgressRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.UpdateWatchProgressRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.UpdateWatchProgressRequest.displayName = 'proto.homeflix.UpdateWatchProgressRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.WatchProgress = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.WatchProgress, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.WatchProgress.displayName = 'proto.homeflix.WatchProgress';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetWatchHistoryRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.GetWatchHistoryRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetWatchHistoryRequest.displayName = 'proto.homeflix.GetWatchHistoryRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetWatchHistoryResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.GetWatchHistoryResponse.repeatedFields_, null);
};
goog.inherits(proto.homeflix.GetWatchHistoryResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetWatchHistoryResponse.displayName = 'proto.homeflix.GetWatchHistoryResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.WatchHistoryItem = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.WatchHistoryItem, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.WatchHistoryItem.displayName = 'proto.homeflix.WatchHistoryItem';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RecommendationRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.RecommendationRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RecommendationRequest.displayName = 'proto.homeflix.RecommendationRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RecommendationResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.RecommendationResponse.repeatedFields_, null);
};
goog.inherits(proto.homeflix.RecommendationResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RecommendationResponse.displayName = 'proto.homeflix.RecommendationResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RecommendationStreamRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.RecommendationStreamRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RecommendationStreamRequest.displayName = 'proto.homeflix.RecommendationStreamRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RecommendationUpdate = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.RecommendationUpdate.repeatedFields_, null);
};
goog.inherits(proto.homeflix.RecommendationUpdate, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RecommendationUpdate.displayName = 'proto.homeflix.RecommendationUpdate';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RecommendationItem = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.RecommendationItem.repeatedFields_, null);
};
goog.inherits(proto.homeflix.RecommendationItem, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RecommendationItem.displayName = 'proto.homeflix.RecommendationItem';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RateMediaRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.RateMediaRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RateMediaRequest.displayName = 'proto.homeflix.RateMediaRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.RateMediaResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.RateMediaResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.RateMediaResponse.displayName = 'proto.homeflix.RateMediaResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.SimilarMediaRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.SimilarMediaRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.SimilarMediaRequest.displayName = 'proto.homeflix.SimilarMediaRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PlaybackCommand = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.PlaybackCommand, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PlaybackCommand.displayName = 'proto.homeflix.PlaybackCommand';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PlaybackStatus = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.PlaybackStatus, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PlaybackStatus.displayName = 'proto.homeflix.PlaybackStatus';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.SyncPlaybackRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.SyncPlaybackRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.SyncPlaybackRequest.displayName = 'proto.homeflix.SyncPlaybackRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.SyncPlaybackResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.SyncPlaybackResponse.repeatedFields_, null);
};
goog.inherits(proto.homeflix.SyncPlaybackResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.SyncPlaybackResponse.displayName = 'proto.homeflix.SyncPlaybackResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PlaybackStateRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.PlaybackStateRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PlaybackStateRequest.displayName = 'proto.homeflix.PlaybackStateRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.PlaybackState = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.PlaybackState.repeatedFields_, null);
};
goog.inherits(proto.homeflix.PlaybackState, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.PlaybackState.displayName = 'proto.homeflix.PlaybackState';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.SystemHealth = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.SystemHealth.repeatedFields_, null);
};
goog.inherits(proto.homeflix.SystemHealth, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.SystemHealth.displayName = 'proto.homeflix.SystemHealth';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.StreamingMetrics = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.StreamingMetrics.repeatedFields_, null);
};
goog.inherits(proto.homeflix.StreamingMetrics, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.StreamingMetrics.displayName = 'proto.homeflix.StreamingMetrics';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.StreamingSession = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.StreamingSession, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.StreamingSession.displayName = 'proto.homeflix.StreamingSession';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.ScanLibraryRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.ScanLibraryRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.ScanLibraryRequest.displayName = 'proto.homeflix.ScanLibraryRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.ScanProgress = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.ScanProgress.repeatedFields_, null);
};
goog.inherits(proto.homeflix.ScanProgress, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.ScanProgress.displayName = 'proto.homeflix.ScanProgress';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.ScanStatus = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.ScanStatus, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.ScanStatus.displayName = 'proto.homeflix.ScanStatus';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.AdminPreviewQueue = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.AdminPreviewQueue.repeatedFields_, null);
};
goog.inherits(proto.homeflix.AdminPreviewQueue, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.AdminPreviewQueue.displayName = 'proto.homeflix.AdminPreviewQueue';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetAllUsersRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.GetAllUsersRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetAllUsersRequest.displayName = 'proto.homeflix.GetAllUsersRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.GetAllUsersResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.homeflix.GetAllUsersResponse.repeatedFields_, null);
};
goog.inherits(proto.homeflix.GetAllUsersResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.GetAllUsersResponse.displayName = 'proto.homeflix.GetAllUsersResponse';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.homeflix.DeleteUserRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.homeflix.DeleteUserRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.homeflix.DeleteUserRequest.displayName = 'proto.homeflix.DeleteUserRequest';
}

/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.Movie.repeatedFields_ = [7,20];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.Movie.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.Movie.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.Movie} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.Movie.toObject = function(includeInstance, msg) {
  var f, obj = {
    id: jspb.Message.getFieldWithDefault(msg, 1, ""),
    title: jspb.Message.getFieldWithDefault(msg, 2, ""),
    description: jspb.Message.getFieldWithDefault(msg, 3, ""),
    posterUrl: jspb.Message.getFieldWithDefault(msg, 4, ""),
    backdropUrl: jspb.Message.getFieldWithDefault(msg, 5, ""),
    trailerUrl: jspb.Message.getFieldWithDefault(msg, 6, ""),
    genresList: (f = jspb.Message.getRepeatedField(msg, 7)) == null ? undefined : f,
    year: jspb.Message.getFieldWithDefault(msg, 8, 0),
    runtime: jspb.Message.getFieldWithDefault(msg, 9, 0),
    rating: jspb.Message.getFloatingPointFieldWithDefault(msg, 10, 0.0),
    filePath: jspb.Message.getFieldWithDefault(msg, 11, ""),
    fileSize: jspb.Message.getFieldWithDefault(msg, 12, 0),
    videoCodec: jspb.Message.getFieldWithDefault(msg, 13, ""),
    audioCodec: jspb.Message.getFieldWithDefault(msg, 14, ""),
    resolution: jspb.Message.getFieldWithDefault(msg, 15, ""),
    createdAt: (f = msg.getCreatedAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    updatedAt: (f = msg.getUpdatedAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    hasPreview: jspb.Message.getBooleanFieldWithDefault(msg, 18, false),
    hasSubtitles: jspb.Message.getBooleanFieldWithDefault(msg, 19, false),
    subtitleLanguagesList: (f = jspb.Message.getRepeatedField(msg, 20)) == null ? undefined : f
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.Movie}
 */
proto.homeflix.Movie.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.Movie;
  return proto.homeflix.Movie.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.Movie} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.Movie}
 */
proto.homeflix.Movie.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setTitle(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setDescription(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setPosterUrl(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setBackdropUrl(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.setTrailerUrl(value);
      break;
    case 7:
      var value = /** @type {string} */ (reader.readString());
      msg.addGenres(value);
      break;
    case 8:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setYear(value);
      break;
    case 9:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setRuntime(value);
      break;
    case 10:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setRating(value);
      break;
    case 11:
      var value = /** @type {string} */ (reader.readString());
      msg.setFilePath(value);
      break;
    case 12:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setFileSize(value);
      break;
    case 13:
      var value = /** @type {string} */ (reader.readString());
      msg.setVideoCodec(value);
      break;
    case 14:
      var value = /** @type {string} */ (reader.readString());
      msg.setAudioCodec(value);
      break;
    case 15:
      var value = /** @type {string} */ (reader.readString());
      msg.setResolution(value);
      break;
    case 16:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setCreatedAt(value);
      break;
    case 17:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setUpdatedAt(value);
      break;
    case 18:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setHasPreview(value);
      break;
    case 19:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setHasSubtitles(value);
      break;
    case 20:
      var value = /** @type {string} */ (reader.readString());
      msg.addSubtitleLanguages(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.Movie.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.Movie.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.Movie} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.Movie.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getTitle();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getDescription();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getPosterUrl();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getBackdropUrl();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
  f = message.getTrailerUrl();
  if (f.length > 0) {
    writer.writeString(
      6,
      f
    );
  }
  f = message.getGenresList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      7,
      f
    );
  }
  f = message.getYear();
  if (f !== 0) {
    writer.writeInt32(
      8,
      f
    );
  }
  f = message.getRuntime();
  if (f !== 0) {
    writer.writeInt32(
      9,
      f
    );
  }
  f = message.getRating();
  if (f !== 0.0) {
    writer.writeDouble(
      10,
      f
    );
  }
  f = message.getFilePath();
  if (f.length > 0) {
    writer.writeString(
      11,
      f
    );
  }
  f = message.getFileSize();
  if (f !== 0) {
    writer.writeInt64(
      12,
      f
    );
  }
  f = message.getVideoCodec();
  if (f.length > 0) {
    writer.writeString(
      13,
      f
    );
  }
  f = message.getAudioCodec();
  if (f.length > 0) {
    writer.writeString(
      14,
      f
    );
  }
  f = message.getResolution();
  if (f.length > 0) {
    writer.writeString(
      15,
      f
    );
  }
  f = message.getCreatedAt();
  if (f != null) {
    writer.writeMessage(
      16,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getUpdatedAt();
  if (f != null) {
    writer.writeMessage(
      17,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getHasPreview();
  if (f) {
    writer.writeBool(
      18,
      f
    );
  }
  f = message.getHasSubtitles();
  if (f) {
    writer.writeBool(
      19,
      f
    );
  }
  f = message.getSubtitleLanguagesList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      20,
      f
    );
  }
};


/**
 * optional string id = 1;
 * @return {string}
 */
proto.homeflix.Movie.prototype.getId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string title = 2;
 * @return {string}
 */
proto.homeflix.Movie.prototype.getTitle = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setTitle = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string description = 3;
 * @return {string}
 */
proto.homeflix.Movie.prototype.getDescription = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setDescription = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string poster_url = 4;
 * @return {string}
 */
proto.homeflix.Movie.prototype.getPosterUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setPosterUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional string backdrop_url = 5;
 * @return {string}
 */
proto.homeflix.Movie.prototype.getBackdropUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setBackdropUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};


/**
 * optional string trailer_url = 6;
 * @return {string}
 */
proto.homeflix.Movie.prototype.getTrailerUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 6, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setTrailerUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 6, value);
};


/**
 * repeated string genres = 7;
 * @return {!Array<string>}
 */
proto.homeflix.Movie.prototype.getGenresList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 7));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setGenresList = function(value) {
  return jspb.Message.setField(this, 7, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.addGenres = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 7, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.clearGenresList = function() {
  return this.setGenresList([]);
};


/**
 * optional int32 year = 8;
 * @return {number}
 */
proto.homeflix.Movie.prototype.getYear = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 8, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setYear = function(value) {
  return jspb.Message.setProto3IntField(this, 8, value);
};


/**
 * optional int32 runtime = 9;
 * @return {number}
 */
proto.homeflix.Movie.prototype.getRuntime = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 9, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setRuntime = function(value) {
  return jspb.Message.setProto3IntField(this, 9, value);
};


/**
 * optional double rating = 10;
 * @return {number}
 */
proto.homeflix.Movie.prototype.getRating = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 10, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setRating = function(value) {
  return jspb.Message.setProto3FloatField(this, 10, value);
};


/**
 * optional string file_path = 11;
 * @return {string}
 */
proto.homeflix.Movie.prototype.getFilePath = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 11, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setFilePath = function(value) {
  return jspb.Message.setProto3StringField(this, 11, value);
};


/**
 * optional int64 file_size = 12;
 * @return {number}
 */
proto.homeflix.Movie.prototype.getFileSize = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 12, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setFileSize = function(value) {
  return jspb.Message.setProto3IntField(this, 12, value);
};


/**
 * optional string video_codec = 13;
 * @return {string}
 */
proto.homeflix.Movie.prototype.getVideoCodec = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 13, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setVideoCodec = function(value) {
  return jspb.Message.setProto3StringField(this, 13, value);
};


/**
 * optional string audio_codec = 14;
 * @return {string}
 */
proto.homeflix.Movie.prototype.getAudioCodec = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 14, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setAudioCodec = function(value) {
  return jspb.Message.setProto3StringField(this, 14, value);
};


/**
 * optional string resolution = 15;
 * @return {string}
 */
proto.homeflix.Movie.prototype.getResolution = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 15, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setResolution = function(value) {
  return jspb.Message.setProto3StringField(this, 15, value);
};


/**
 * optional google.protobuf.Timestamp created_at = 16;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.Movie.prototype.getCreatedAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 16));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.Movie} returns this
*/
proto.homeflix.Movie.prototype.setCreatedAt = function(value) {
  return jspb.Message.setWrapperField(this, 16, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.clearCreatedAt = function() {
  return this.setCreatedAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.Movie.prototype.hasCreatedAt = function() {
  return jspb.Message.getField(this, 16) != null;
};


/**
 * optional google.protobuf.Timestamp updated_at = 17;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.Movie.prototype.getUpdatedAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 17));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.Movie} returns this
*/
proto.homeflix.Movie.prototype.setUpdatedAt = function(value) {
  return jspb.Message.setWrapperField(this, 17, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.clearUpdatedAt = function() {
  return this.setUpdatedAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.Movie.prototype.hasUpdatedAt = function() {
  return jspb.Message.getField(this, 17) != null;
};


/**
 * optional bool has_preview = 18;
 * @return {boolean}
 */
proto.homeflix.Movie.prototype.getHasPreview = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 18, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setHasPreview = function(value) {
  return jspb.Message.setProto3BooleanField(this, 18, value);
};


/**
 * optional bool has_subtitles = 19;
 * @return {boolean}
 */
proto.homeflix.Movie.prototype.getHasSubtitles = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 19, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setHasSubtitles = function(value) {
  return jspb.Message.setProto3BooleanField(this, 19, value);
};


/**
 * repeated string subtitle_languages = 20;
 * @return {!Array<string>}
 */
proto.homeflix.Movie.prototype.getSubtitleLanguagesList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 20));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.setSubtitleLanguagesList = function(value) {
  return jspb.Message.setField(this, 20, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.addSubtitleLanguages = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 20, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.Movie} returns this
 */
proto.homeflix.Movie.prototype.clearSubtitleLanguagesList = function() {
  return this.setSubtitleLanguagesList([]);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.Series.repeatedFields_ = [6,9];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.Series.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.Series.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.Series} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.Series.toObject = function(includeInstance, msg) {
  var f, obj = {
    id: jspb.Message.getFieldWithDefault(msg, 1, ""),
    title: jspb.Message.getFieldWithDefault(msg, 2, ""),
    description: jspb.Message.getFieldWithDefault(msg, 3, ""),
    posterUrl: jspb.Message.getFieldWithDefault(msg, 4, ""),
    backdropUrl: jspb.Message.getFieldWithDefault(msg, 5, ""),
    genresList: (f = jspb.Message.getRepeatedField(msg, 6)) == null ? undefined : f,
    year: jspb.Message.getFieldWithDefault(msg, 7, 0),
    rating: jspb.Message.getFloatingPointFieldWithDefault(msg, 8, 0.0),
    seasonsList: jspb.Message.toObjectList(msg.getSeasonsList(),
    proto.homeflix.Season.toObject, includeInstance),
    createdAt: (f = msg.getCreatedAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    updatedAt: (f = msg.getUpdatedAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    totalEpisodes: jspb.Message.getFieldWithDefault(msg, 12, 0),
    status: jspb.Message.getFieldWithDefault(msg, 13, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.Series}
 */
proto.homeflix.Series.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.Series;
  return proto.homeflix.Series.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.Series} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.Series}
 */
proto.homeflix.Series.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setTitle(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setDescription(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setPosterUrl(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setBackdropUrl(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.addGenres(value);
      break;
    case 7:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setYear(value);
      break;
    case 8:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setRating(value);
      break;
    case 9:
      var value = new proto.homeflix.Season;
      reader.readMessage(value,proto.homeflix.Season.deserializeBinaryFromReader);
      msg.addSeasons(value);
      break;
    case 10:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setCreatedAt(value);
      break;
    case 11:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setUpdatedAt(value);
      break;
    case 12:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalEpisodes(value);
      break;
    case 13:
      var value = /** @type {string} */ (reader.readString());
      msg.setStatus(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.Series.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.Series.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.Series} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.Series.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getTitle();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getDescription();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getPosterUrl();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getBackdropUrl();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
  f = message.getGenresList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      6,
      f
    );
  }
  f = message.getYear();
  if (f !== 0) {
    writer.writeInt32(
      7,
      f
    );
  }
  f = message.getRating();
  if (f !== 0.0) {
    writer.writeDouble(
      8,
      f
    );
  }
  f = message.getSeasonsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      9,
      f,
      proto.homeflix.Season.serializeBinaryToWriter
    );
  }
  f = message.getCreatedAt();
  if (f != null) {
    writer.writeMessage(
      10,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getUpdatedAt();
  if (f != null) {
    writer.writeMessage(
      11,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getTotalEpisodes();
  if (f !== 0) {
    writer.writeInt32(
      12,
      f
    );
  }
  f = message.getStatus();
  if (f.length > 0) {
    writer.writeString(
      13,
      f
    );
  }
};


/**
 * optional string id = 1;
 * @return {string}
 */
proto.homeflix.Series.prototype.getId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.setId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string title = 2;
 * @return {string}
 */
proto.homeflix.Series.prototype.getTitle = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.setTitle = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string description = 3;
 * @return {string}
 */
proto.homeflix.Series.prototype.getDescription = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.setDescription = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string poster_url = 4;
 * @return {string}
 */
proto.homeflix.Series.prototype.getPosterUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.setPosterUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional string backdrop_url = 5;
 * @return {string}
 */
proto.homeflix.Series.prototype.getBackdropUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.setBackdropUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};


/**
 * repeated string genres = 6;
 * @return {!Array<string>}
 */
proto.homeflix.Series.prototype.getGenresList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 6));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.setGenresList = function(value) {
  return jspb.Message.setField(this, 6, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.addGenres = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 6, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.clearGenresList = function() {
  return this.setGenresList([]);
};


/**
 * optional int32 year = 7;
 * @return {number}
 */
proto.homeflix.Series.prototype.getYear = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 7, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.setYear = function(value) {
  return jspb.Message.setProto3IntField(this, 7, value);
};


/**
 * optional double rating = 8;
 * @return {number}
 */
proto.homeflix.Series.prototype.getRating = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 8, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.setRating = function(value) {
  return jspb.Message.setProto3FloatField(this, 8, value);
};


/**
 * repeated Season seasons = 9;
 * @return {!Array<!proto.homeflix.Season>}
 */
proto.homeflix.Series.prototype.getSeasonsList = function() {
  return /** @type{!Array<!proto.homeflix.Season>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.Season, 9));
};


/**
 * @param {!Array<!proto.homeflix.Season>} value
 * @return {!proto.homeflix.Series} returns this
*/
proto.homeflix.Series.prototype.setSeasonsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 9, value);
};


/**
 * @param {!proto.homeflix.Season=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Season}
 */
proto.homeflix.Series.prototype.addSeasons = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 9, opt_value, proto.homeflix.Season, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.clearSeasonsList = function() {
  return this.setSeasonsList([]);
};


/**
 * optional google.protobuf.Timestamp created_at = 10;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.Series.prototype.getCreatedAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 10));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.Series} returns this
*/
proto.homeflix.Series.prototype.setCreatedAt = function(value) {
  return jspb.Message.setWrapperField(this, 10, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.clearCreatedAt = function() {
  return this.setCreatedAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.Series.prototype.hasCreatedAt = function() {
  return jspb.Message.getField(this, 10) != null;
};


/**
 * optional google.protobuf.Timestamp updated_at = 11;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.Series.prototype.getUpdatedAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 11));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.Series} returns this
*/
proto.homeflix.Series.prototype.setUpdatedAt = function(value) {
  return jspb.Message.setWrapperField(this, 11, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.clearUpdatedAt = function() {
  return this.setUpdatedAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.Series.prototype.hasUpdatedAt = function() {
  return jspb.Message.getField(this, 11) != null;
};


/**
 * optional int32 total_episodes = 12;
 * @return {number}
 */
proto.homeflix.Series.prototype.getTotalEpisodes = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 12, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.setTotalEpisodes = function(value) {
  return jspb.Message.setProto3IntField(this, 12, value);
};


/**
 * optional string status = 13;
 * @return {string}
 */
proto.homeflix.Series.prototype.getStatus = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 13, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Series} returns this
 */
proto.homeflix.Series.prototype.setStatus = function(value) {
  return jspb.Message.setProto3StringField(this, 13, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.Season.repeatedFields_ = [7];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.Season.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.Season.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.Season} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.Season.toObject = function(includeInstance, msg) {
  var f, obj = {
    id: jspb.Message.getFieldWithDefault(msg, 1, ""),
    seriesId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    seasonNumber: jspb.Message.getFieldWithDefault(msg, 3, 0),
    title: jspb.Message.getFieldWithDefault(msg, 4, ""),
    description: jspb.Message.getFieldWithDefault(msg, 5, ""),
    posterUrl: jspb.Message.getFieldWithDefault(msg, 6, ""),
    episodesList: jspb.Message.toObjectList(msg.getEpisodesList(),
    proto.homeflix.Episode.toObject, includeInstance),
    airDate: (f = msg.getAirDate()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.Season}
 */
proto.homeflix.Season.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.Season;
  return proto.homeflix.Season.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.Season} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.Season}
 */
proto.homeflix.Season.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setSeriesId(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setSeasonNumber(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setTitle(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setDescription(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.setPosterUrl(value);
      break;
    case 7:
      var value = new proto.homeflix.Episode;
      reader.readMessage(value,proto.homeflix.Episode.deserializeBinaryFromReader);
      msg.addEpisodes(value);
      break;
    case 8:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setAirDate(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.Season.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.Season.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.Season} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.Season.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getSeriesId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getSeasonNumber();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getTitle();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getDescription();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
  f = message.getPosterUrl();
  if (f.length > 0) {
    writer.writeString(
      6,
      f
    );
  }
  f = message.getEpisodesList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      7,
      f,
      proto.homeflix.Episode.serializeBinaryToWriter
    );
  }
  f = message.getAirDate();
  if (f != null) {
    writer.writeMessage(
      8,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
};


/**
 * optional string id = 1;
 * @return {string}
 */
proto.homeflix.Season.prototype.getId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Season} returns this
 */
proto.homeflix.Season.prototype.setId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string series_id = 2;
 * @return {string}
 */
proto.homeflix.Season.prototype.getSeriesId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Season} returns this
 */
proto.homeflix.Season.prototype.setSeriesId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int32 season_number = 3;
 * @return {number}
 */
proto.homeflix.Season.prototype.getSeasonNumber = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Season} returns this
 */
proto.homeflix.Season.prototype.setSeasonNumber = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional string title = 4;
 * @return {string}
 */
proto.homeflix.Season.prototype.getTitle = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Season} returns this
 */
proto.homeflix.Season.prototype.setTitle = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional string description = 5;
 * @return {string}
 */
proto.homeflix.Season.prototype.getDescription = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Season} returns this
 */
proto.homeflix.Season.prototype.setDescription = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};


/**
 * optional string poster_url = 6;
 * @return {string}
 */
proto.homeflix.Season.prototype.getPosterUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 6, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Season} returns this
 */
proto.homeflix.Season.prototype.setPosterUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 6, value);
};


/**
 * repeated Episode episodes = 7;
 * @return {!Array<!proto.homeflix.Episode>}
 */
proto.homeflix.Season.prototype.getEpisodesList = function() {
  return /** @type{!Array<!proto.homeflix.Episode>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.Episode, 7));
};


/**
 * @param {!Array<!proto.homeflix.Episode>} value
 * @return {!proto.homeflix.Season} returns this
*/
proto.homeflix.Season.prototype.setEpisodesList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 7, value);
};


/**
 * @param {!proto.homeflix.Episode=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Episode}
 */
proto.homeflix.Season.prototype.addEpisodes = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 7, opt_value, proto.homeflix.Episode, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.Season} returns this
 */
proto.homeflix.Season.prototype.clearEpisodesList = function() {
  return this.setEpisodesList([]);
};


/**
 * optional google.protobuf.Timestamp air_date = 8;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.Season.prototype.getAirDate = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 8));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.Season} returns this
*/
proto.homeflix.Season.prototype.setAirDate = function(value) {
  return jspb.Message.setWrapperField(this, 8, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.Season} returns this
 */
proto.homeflix.Season.prototype.clearAirDate = function() {
  return this.setAirDate(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.Season.prototype.hasAirDate = function() {
  return jspb.Message.getField(this, 8) != null;
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.Episode.repeatedFields_ = [18];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.Episode.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.Episode.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.Episode} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.Episode.toObject = function(includeInstance, msg) {
  var f, obj = {
    id: jspb.Message.getFieldWithDefault(msg, 1, ""),
    seriesId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    seasonId: jspb.Message.getFieldWithDefault(msg, 3, ""),
    seasonNumber: jspb.Message.getFieldWithDefault(msg, 4, 0),
    episodeNumber: jspb.Message.getFieldWithDefault(msg, 5, 0),
    title: jspb.Message.getFieldWithDefault(msg, 6, ""),
    description: jspb.Message.getFieldWithDefault(msg, 7, ""),
    thumbnailUrl: jspb.Message.getFieldWithDefault(msg, 8, ""),
    runtime: jspb.Message.getFieldWithDefault(msg, 9, 0),
    filePath: jspb.Message.getFieldWithDefault(msg, 10, ""),
    fileSize: jspb.Message.getFieldWithDefault(msg, 11, 0),
    videoCodec: jspb.Message.getFieldWithDefault(msg, 12, ""),
    audioCodec: jspb.Message.getFieldWithDefault(msg, 13, ""),
    resolution: jspb.Message.getFieldWithDefault(msg, 14, ""),
    airDate: (f = msg.getAirDate()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    hasPreview: jspb.Message.getBooleanFieldWithDefault(msg, 16, false),
    hasSubtitles: jspb.Message.getBooleanFieldWithDefault(msg, 17, false),
    subtitleLanguagesList: (f = jspb.Message.getRepeatedField(msg, 18)) == null ? undefined : f
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.Episode}
 */
proto.homeflix.Episode.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.Episode;
  return proto.homeflix.Episode.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.Episode} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.Episode}
 */
proto.homeflix.Episode.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setSeriesId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setSeasonId(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setSeasonNumber(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setEpisodeNumber(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.setTitle(value);
      break;
    case 7:
      var value = /** @type {string} */ (reader.readString());
      msg.setDescription(value);
      break;
    case 8:
      var value = /** @type {string} */ (reader.readString());
      msg.setThumbnailUrl(value);
      break;
    case 9:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setRuntime(value);
      break;
    case 10:
      var value = /** @type {string} */ (reader.readString());
      msg.setFilePath(value);
      break;
    case 11:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setFileSize(value);
      break;
    case 12:
      var value = /** @type {string} */ (reader.readString());
      msg.setVideoCodec(value);
      break;
    case 13:
      var value = /** @type {string} */ (reader.readString());
      msg.setAudioCodec(value);
      break;
    case 14:
      var value = /** @type {string} */ (reader.readString());
      msg.setResolution(value);
      break;
    case 15:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setAirDate(value);
      break;
    case 16:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setHasPreview(value);
      break;
    case 17:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setHasSubtitles(value);
      break;
    case 18:
      var value = /** @type {string} */ (reader.readString());
      msg.addSubtitleLanguages(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.Episode.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.Episode.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.Episode} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.Episode.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getSeriesId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getSeasonId();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getSeasonNumber();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
  f = message.getEpisodeNumber();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
  f = message.getTitle();
  if (f.length > 0) {
    writer.writeString(
      6,
      f
    );
  }
  f = message.getDescription();
  if (f.length > 0) {
    writer.writeString(
      7,
      f
    );
  }
  f = message.getThumbnailUrl();
  if (f.length > 0) {
    writer.writeString(
      8,
      f
    );
  }
  f = message.getRuntime();
  if (f !== 0) {
    writer.writeInt32(
      9,
      f
    );
  }
  f = message.getFilePath();
  if (f.length > 0) {
    writer.writeString(
      10,
      f
    );
  }
  f = message.getFileSize();
  if (f !== 0) {
    writer.writeInt64(
      11,
      f
    );
  }
  f = message.getVideoCodec();
  if (f.length > 0) {
    writer.writeString(
      12,
      f
    );
  }
  f = message.getAudioCodec();
  if (f.length > 0) {
    writer.writeString(
      13,
      f
    );
  }
  f = message.getResolution();
  if (f.length > 0) {
    writer.writeString(
      14,
      f
    );
  }
  f = message.getAirDate();
  if (f != null) {
    writer.writeMessage(
      15,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getHasPreview();
  if (f) {
    writer.writeBool(
      16,
      f
    );
  }
  f = message.getHasSubtitles();
  if (f) {
    writer.writeBool(
      17,
      f
    );
  }
  f = message.getSubtitleLanguagesList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      18,
      f
    );
  }
};


/**
 * optional string id = 1;
 * @return {string}
 */
proto.homeflix.Episode.prototype.getId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string series_id = 2;
 * @return {string}
 */
proto.homeflix.Episode.prototype.getSeriesId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setSeriesId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string season_id = 3;
 * @return {string}
 */
proto.homeflix.Episode.prototype.getSeasonId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setSeasonId = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional int32 season_number = 4;
 * @return {number}
 */
proto.homeflix.Episode.prototype.getSeasonNumber = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setSeasonNumber = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional int32 episode_number = 5;
 * @return {number}
 */
proto.homeflix.Episode.prototype.getEpisodeNumber = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setEpisodeNumber = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


/**
 * optional string title = 6;
 * @return {string}
 */
proto.homeflix.Episode.prototype.getTitle = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 6, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setTitle = function(value) {
  return jspb.Message.setProto3StringField(this, 6, value);
};


/**
 * optional string description = 7;
 * @return {string}
 */
proto.homeflix.Episode.prototype.getDescription = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 7, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setDescription = function(value) {
  return jspb.Message.setProto3StringField(this, 7, value);
};


/**
 * optional string thumbnail_url = 8;
 * @return {string}
 */
proto.homeflix.Episode.prototype.getThumbnailUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 8, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setThumbnailUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 8, value);
};


/**
 * optional int32 runtime = 9;
 * @return {number}
 */
proto.homeflix.Episode.prototype.getRuntime = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 9, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setRuntime = function(value) {
  return jspb.Message.setProto3IntField(this, 9, value);
};


/**
 * optional string file_path = 10;
 * @return {string}
 */
proto.homeflix.Episode.prototype.getFilePath = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 10, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setFilePath = function(value) {
  return jspb.Message.setProto3StringField(this, 10, value);
};


/**
 * optional int64 file_size = 11;
 * @return {number}
 */
proto.homeflix.Episode.prototype.getFileSize = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 11, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setFileSize = function(value) {
  return jspb.Message.setProto3IntField(this, 11, value);
};


/**
 * optional string video_codec = 12;
 * @return {string}
 */
proto.homeflix.Episode.prototype.getVideoCodec = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 12, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setVideoCodec = function(value) {
  return jspb.Message.setProto3StringField(this, 12, value);
};


/**
 * optional string audio_codec = 13;
 * @return {string}
 */
proto.homeflix.Episode.prototype.getAudioCodec = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 13, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setAudioCodec = function(value) {
  return jspb.Message.setProto3StringField(this, 13, value);
};


/**
 * optional string resolution = 14;
 * @return {string}
 */
proto.homeflix.Episode.prototype.getResolution = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 14, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setResolution = function(value) {
  return jspb.Message.setProto3StringField(this, 14, value);
};


/**
 * optional google.protobuf.Timestamp air_date = 15;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.Episode.prototype.getAirDate = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 15));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.Episode} returns this
*/
proto.homeflix.Episode.prototype.setAirDate = function(value) {
  return jspb.Message.setWrapperField(this, 15, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.clearAirDate = function() {
  return this.setAirDate(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.Episode.prototype.hasAirDate = function() {
  return jspb.Message.getField(this, 15) != null;
};


/**
 * optional bool has_preview = 16;
 * @return {boolean}
 */
proto.homeflix.Episode.prototype.getHasPreview = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 16, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setHasPreview = function(value) {
  return jspb.Message.setProto3BooleanField(this, 16, value);
};


/**
 * optional bool has_subtitles = 17;
 * @return {boolean}
 */
proto.homeflix.Episode.prototype.getHasSubtitles = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 17, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setHasSubtitles = function(value) {
  return jspb.Message.setProto3BooleanField(this, 17, value);
};


/**
 * repeated string subtitle_languages = 18;
 * @return {!Array<string>}
 */
proto.homeflix.Episode.prototype.getSubtitleLanguagesList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 18));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.setSubtitleLanguagesList = function(value) {
  return jspb.Message.setField(this, 18, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.addSubtitleLanguages = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 18, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.Episode} returns this
 */
proto.homeflix.Episode.prototype.clearSubtitleLanguagesList = function() {
  return this.setSubtitleLanguagesList([]);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.GetMoviesRequest.repeatedFields_ = [5];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetMoviesRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetMoviesRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetMoviesRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetMoviesRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    page: jspb.Message.getFieldWithDefault(msg, 1, 0),
    limit: jspb.Message.getFieldWithDefault(msg, 2, 0),
    sortBy: jspb.Message.getFieldWithDefault(msg, 3, ""),
    sortOrder: jspb.Message.getFieldWithDefault(msg, 4, ""),
    genresList: (f = jspb.Message.getRepeatedField(msg, 5)) == null ? undefined : f,
    minYear: jspb.Message.getFieldWithDefault(msg, 6, 0),
    maxYear: jspb.Message.getFieldWithDefault(msg, 7, 0),
    minRating: jspb.Message.getFloatingPointFieldWithDefault(msg, 8, 0.0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetMoviesRequest}
 */
proto.homeflix.GetMoviesRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetMoviesRequest;
  return proto.homeflix.GetMoviesRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetMoviesRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetMoviesRequest}
 */
proto.homeflix.GetMoviesRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setPage(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setSortBy(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setSortOrder(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.addGenres(value);
      break;
    case 6:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setMinYear(value);
      break;
    case 7:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setMaxYear(value);
      break;
    case 8:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setMinRating(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetMoviesRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetMoviesRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetMoviesRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetMoviesRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getPage();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getSortBy();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getSortOrder();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getGenresList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      5,
      f
    );
  }
  f = message.getMinYear();
  if (f !== 0) {
    writer.writeInt32(
      6,
      f
    );
  }
  f = message.getMaxYear();
  if (f !== 0) {
    writer.writeInt32(
      7,
      f
    );
  }
  f = message.getMinRating();
  if (f !== 0.0) {
    writer.writeDouble(
      8,
      f
    );
  }
};


/**
 * optional int32 page = 1;
 * @return {number}
 */
proto.homeflix.GetMoviesRequest.prototype.getPage = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetMoviesRequest} returns this
 */
proto.homeflix.GetMoviesRequest.prototype.setPage = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional int32 limit = 2;
 * @return {number}
 */
proto.homeflix.GetMoviesRequest.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetMoviesRequest} returns this
 */
proto.homeflix.GetMoviesRequest.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional string sort_by = 3;
 * @return {string}
 */
proto.homeflix.GetMoviesRequest.prototype.getSortBy = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetMoviesRequest} returns this
 */
proto.homeflix.GetMoviesRequest.prototype.setSortBy = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string sort_order = 4;
 * @return {string}
 */
proto.homeflix.GetMoviesRequest.prototype.getSortOrder = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetMoviesRequest} returns this
 */
proto.homeflix.GetMoviesRequest.prototype.setSortOrder = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * repeated string genres = 5;
 * @return {!Array<string>}
 */
proto.homeflix.GetMoviesRequest.prototype.getGenresList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 5));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.GetMoviesRequest} returns this
 */
proto.homeflix.GetMoviesRequest.prototype.setGenresList = function(value) {
  return jspb.Message.setField(this, 5, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.GetMoviesRequest} returns this
 */
proto.homeflix.GetMoviesRequest.prototype.addGenres = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 5, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.GetMoviesRequest} returns this
 */
proto.homeflix.GetMoviesRequest.prototype.clearGenresList = function() {
  return this.setGenresList([]);
};


/**
 * optional int32 min_year = 6;
 * @return {number}
 */
proto.homeflix.GetMoviesRequest.prototype.getMinYear = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 6, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetMoviesRequest} returns this
 */
proto.homeflix.GetMoviesRequest.prototype.setMinYear = function(value) {
  return jspb.Message.setProto3IntField(this, 6, value);
};


/**
 * optional int32 max_year = 7;
 * @return {number}
 */
proto.homeflix.GetMoviesRequest.prototype.getMaxYear = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 7, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetMoviesRequest} returns this
 */
proto.homeflix.GetMoviesRequest.prototype.setMaxYear = function(value) {
  return jspb.Message.setProto3IntField(this, 7, value);
};


/**
 * optional double min_rating = 8;
 * @return {number}
 */
proto.homeflix.GetMoviesRequest.prototype.getMinRating = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 8, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetMoviesRequest} returns this
 */
proto.homeflix.GetMoviesRequest.prototype.setMinRating = function(value) {
  return jspb.Message.setProto3FloatField(this, 8, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.GetMoviesResponse.repeatedFields_ = [1];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetMoviesResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetMoviesResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetMoviesResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetMoviesResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    moviesList: jspb.Message.toObjectList(msg.getMoviesList(),
    proto.homeflix.Movie.toObject, includeInstance),
    totalCount: jspb.Message.getFieldWithDefault(msg, 2, 0),
    page: jspb.Message.getFieldWithDefault(msg, 3, 0),
    limit: jspb.Message.getFieldWithDefault(msg, 4, 0),
    hasNext: jspb.Message.getBooleanFieldWithDefault(msg, 5, false),
    hasPrev: jspb.Message.getBooleanFieldWithDefault(msg, 6, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetMoviesResponse}
 */
proto.homeflix.GetMoviesResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetMoviesResponse;
  return proto.homeflix.GetMoviesResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetMoviesResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetMoviesResponse}
 */
proto.homeflix.GetMoviesResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.homeflix.Movie;
      reader.readMessage(value,proto.homeflix.Movie.deserializeBinaryFromReader);
      msg.addMovies(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalCount(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setPage(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    case 5:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setHasNext(value);
      break;
    case 6:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setHasPrev(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetMoviesResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetMoviesResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetMoviesResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetMoviesResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMoviesList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.homeflix.Movie.serializeBinaryToWriter
    );
  }
  f = message.getTotalCount();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getPage();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
  f = message.getHasNext();
  if (f) {
    writer.writeBool(
      5,
      f
    );
  }
  f = message.getHasPrev();
  if (f) {
    writer.writeBool(
      6,
      f
    );
  }
};


/**
 * repeated Movie movies = 1;
 * @return {!Array<!proto.homeflix.Movie>}
 */
proto.homeflix.GetMoviesResponse.prototype.getMoviesList = function() {
  return /** @type{!Array<!proto.homeflix.Movie>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.Movie, 1));
};


/**
 * @param {!Array<!proto.homeflix.Movie>} value
 * @return {!proto.homeflix.GetMoviesResponse} returns this
*/
proto.homeflix.GetMoviesResponse.prototype.setMoviesList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.homeflix.Movie=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Movie}
 */
proto.homeflix.GetMoviesResponse.prototype.addMovies = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.homeflix.Movie, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.GetMoviesResponse} returns this
 */
proto.homeflix.GetMoviesResponse.prototype.clearMoviesList = function() {
  return this.setMoviesList([]);
};


/**
 * optional int32 total_count = 2;
 * @return {number}
 */
proto.homeflix.GetMoviesResponse.prototype.getTotalCount = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetMoviesResponse} returns this
 */
proto.homeflix.GetMoviesResponse.prototype.setTotalCount = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional int32 page = 3;
 * @return {number}
 */
proto.homeflix.GetMoviesResponse.prototype.getPage = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetMoviesResponse} returns this
 */
proto.homeflix.GetMoviesResponse.prototype.setPage = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional int32 limit = 4;
 * @return {number}
 */
proto.homeflix.GetMoviesResponse.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetMoviesResponse} returns this
 */
proto.homeflix.GetMoviesResponse.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional bool has_next = 5;
 * @return {boolean}
 */
proto.homeflix.GetMoviesResponse.prototype.getHasNext = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 5, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.GetMoviesResponse} returns this
 */
proto.homeflix.GetMoviesResponse.prototype.setHasNext = function(value) {
  return jspb.Message.setProto3BooleanField(this, 5, value);
};


/**
 * optional bool has_prev = 6;
 * @return {boolean}
 */
proto.homeflix.GetMoviesResponse.prototype.getHasPrev = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 6, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.GetMoviesResponse} returns this
 */
proto.homeflix.GetMoviesResponse.prototype.setHasPrev = function(value) {
  return jspb.Message.setProto3BooleanField(this, 6, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetMovieRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetMovieRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetMovieRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetMovieRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    id: jspb.Message.getFieldWithDefault(msg, 1, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetMovieRequest}
 */
proto.homeflix.GetMovieRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetMovieRequest;
  return proto.homeflix.GetMovieRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetMovieRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetMovieRequest}
 */
proto.homeflix.GetMovieRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetMovieRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetMovieRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetMovieRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetMovieRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string id = 1;
 * @return {string}
 */
proto.homeflix.GetMovieRequest.prototype.getId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetMovieRequest} returns this
 */
proto.homeflix.GetMovieRequest.prototype.setId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.GetSeriesRequest.repeatedFields_ = [5];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetSeriesRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetSeriesRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetSeriesRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetSeriesRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    page: jspb.Message.getFieldWithDefault(msg, 1, 0),
    limit: jspb.Message.getFieldWithDefault(msg, 2, 0),
    sortBy: jspb.Message.getFieldWithDefault(msg, 3, ""),
    sortOrder: jspb.Message.getFieldWithDefault(msg, 4, ""),
    genresList: (f = jspb.Message.getRepeatedField(msg, 5)) == null ? undefined : f,
    minYear: jspb.Message.getFieldWithDefault(msg, 6, 0),
    maxYear: jspb.Message.getFieldWithDefault(msg, 7, 0),
    minRating: jspb.Message.getFloatingPointFieldWithDefault(msg, 8, 0.0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetSeriesRequest}
 */
proto.homeflix.GetSeriesRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetSeriesRequest;
  return proto.homeflix.GetSeriesRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetSeriesRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetSeriesRequest}
 */
proto.homeflix.GetSeriesRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setPage(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setSortBy(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setSortOrder(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.addGenres(value);
      break;
    case 6:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setMinYear(value);
      break;
    case 7:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setMaxYear(value);
      break;
    case 8:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setMinRating(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetSeriesRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetSeriesRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetSeriesRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetSeriesRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getPage();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getSortBy();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getSortOrder();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getGenresList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      5,
      f
    );
  }
  f = message.getMinYear();
  if (f !== 0) {
    writer.writeInt32(
      6,
      f
    );
  }
  f = message.getMaxYear();
  if (f !== 0) {
    writer.writeInt32(
      7,
      f
    );
  }
  f = message.getMinRating();
  if (f !== 0.0) {
    writer.writeDouble(
      8,
      f
    );
  }
};


/**
 * optional int32 page = 1;
 * @return {number}
 */
proto.homeflix.GetSeriesRequest.prototype.getPage = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetSeriesRequest} returns this
 */
proto.homeflix.GetSeriesRequest.prototype.setPage = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional int32 limit = 2;
 * @return {number}
 */
proto.homeflix.GetSeriesRequest.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetSeriesRequest} returns this
 */
proto.homeflix.GetSeriesRequest.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional string sort_by = 3;
 * @return {string}
 */
proto.homeflix.GetSeriesRequest.prototype.getSortBy = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetSeriesRequest} returns this
 */
proto.homeflix.GetSeriesRequest.prototype.setSortBy = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string sort_order = 4;
 * @return {string}
 */
proto.homeflix.GetSeriesRequest.prototype.getSortOrder = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetSeriesRequest} returns this
 */
proto.homeflix.GetSeriesRequest.prototype.setSortOrder = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * repeated string genres = 5;
 * @return {!Array<string>}
 */
proto.homeflix.GetSeriesRequest.prototype.getGenresList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 5));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.GetSeriesRequest} returns this
 */
proto.homeflix.GetSeriesRequest.prototype.setGenresList = function(value) {
  return jspb.Message.setField(this, 5, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.GetSeriesRequest} returns this
 */
proto.homeflix.GetSeriesRequest.prototype.addGenres = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 5, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.GetSeriesRequest} returns this
 */
proto.homeflix.GetSeriesRequest.prototype.clearGenresList = function() {
  return this.setGenresList([]);
};


/**
 * optional int32 min_year = 6;
 * @return {number}
 */
proto.homeflix.GetSeriesRequest.prototype.getMinYear = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 6, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetSeriesRequest} returns this
 */
proto.homeflix.GetSeriesRequest.prototype.setMinYear = function(value) {
  return jspb.Message.setProto3IntField(this, 6, value);
};


/**
 * optional int32 max_year = 7;
 * @return {number}
 */
proto.homeflix.GetSeriesRequest.prototype.getMaxYear = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 7, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetSeriesRequest} returns this
 */
proto.homeflix.GetSeriesRequest.prototype.setMaxYear = function(value) {
  return jspb.Message.setProto3IntField(this, 7, value);
};


/**
 * optional double min_rating = 8;
 * @return {number}
 */
proto.homeflix.GetSeriesRequest.prototype.getMinRating = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 8, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetSeriesRequest} returns this
 */
proto.homeflix.GetSeriesRequest.prototype.setMinRating = function(value) {
  return jspb.Message.setProto3FloatField(this, 8, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.GetSeriesResponse.repeatedFields_ = [1];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetSeriesResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetSeriesResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetSeriesResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetSeriesResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    seriesList: jspb.Message.toObjectList(msg.getSeriesList(),
    proto.homeflix.Series.toObject, includeInstance),
    totalCount: jspb.Message.getFieldWithDefault(msg, 2, 0),
    page: jspb.Message.getFieldWithDefault(msg, 3, 0),
    limit: jspb.Message.getFieldWithDefault(msg, 4, 0),
    hasNext: jspb.Message.getBooleanFieldWithDefault(msg, 5, false),
    hasPrev: jspb.Message.getBooleanFieldWithDefault(msg, 6, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetSeriesResponse}
 */
proto.homeflix.GetSeriesResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetSeriesResponse;
  return proto.homeflix.GetSeriesResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetSeriesResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetSeriesResponse}
 */
proto.homeflix.GetSeriesResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.homeflix.Series;
      reader.readMessage(value,proto.homeflix.Series.deserializeBinaryFromReader);
      msg.addSeries(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalCount(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setPage(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    case 5:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setHasNext(value);
      break;
    case 6:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setHasPrev(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetSeriesResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetSeriesResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetSeriesResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetSeriesResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSeriesList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.homeflix.Series.serializeBinaryToWriter
    );
  }
  f = message.getTotalCount();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getPage();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
  f = message.getHasNext();
  if (f) {
    writer.writeBool(
      5,
      f
    );
  }
  f = message.getHasPrev();
  if (f) {
    writer.writeBool(
      6,
      f
    );
  }
};


/**
 * repeated Series series = 1;
 * @return {!Array<!proto.homeflix.Series>}
 */
proto.homeflix.GetSeriesResponse.prototype.getSeriesList = function() {
  return /** @type{!Array<!proto.homeflix.Series>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.Series, 1));
};


/**
 * @param {!Array<!proto.homeflix.Series>} value
 * @return {!proto.homeflix.GetSeriesResponse} returns this
*/
proto.homeflix.GetSeriesResponse.prototype.setSeriesList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.homeflix.Series=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Series}
 */
proto.homeflix.GetSeriesResponse.prototype.addSeries = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.homeflix.Series, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.GetSeriesResponse} returns this
 */
proto.homeflix.GetSeriesResponse.prototype.clearSeriesList = function() {
  return this.setSeriesList([]);
};


/**
 * optional int32 total_count = 2;
 * @return {number}
 */
proto.homeflix.GetSeriesResponse.prototype.getTotalCount = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetSeriesResponse} returns this
 */
proto.homeflix.GetSeriesResponse.prototype.setTotalCount = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional int32 page = 3;
 * @return {number}
 */
proto.homeflix.GetSeriesResponse.prototype.getPage = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetSeriesResponse} returns this
 */
proto.homeflix.GetSeriesResponse.prototype.setPage = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional int32 limit = 4;
 * @return {number}
 */
proto.homeflix.GetSeriesResponse.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetSeriesResponse} returns this
 */
proto.homeflix.GetSeriesResponse.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional bool has_next = 5;
 * @return {boolean}
 */
proto.homeflix.GetSeriesResponse.prototype.getHasNext = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 5, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.GetSeriesResponse} returns this
 */
proto.homeflix.GetSeriesResponse.prototype.setHasNext = function(value) {
  return jspb.Message.setProto3BooleanField(this, 5, value);
};


/**
 * optional bool has_prev = 6;
 * @return {boolean}
 */
proto.homeflix.GetSeriesResponse.prototype.getHasPrev = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 6, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.GetSeriesResponse} returns this
 */
proto.homeflix.GetSeriesResponse.prototype.setHasPrev = function(value) {
  return jspb.Message.setProto3BooleanField(this, 6, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetSeriesDetailsRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetSeriesDetailsRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetSeriesDetailsRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetSeriesDetailsRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    id: jspb.Message.getFieldWithDefault(msg, 1, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetSeriesDetailsRequest}
 */
proto.homeflix.GetSeriesDetailsRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetSeriesDetailsRequest;
  return proto.homeflix.GetSeriesDetailsRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetSeriesDetailsRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetSeriesDetailsRequest}
 */
proto.homeflix.GetSeriesDetailsRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetSeriesDetailsRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetSeriesDetailsRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetSeriesDetailsRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetSeriesDetailsRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string id = 1;
 * @return {string}
 */
proto.homeflix.GetSeriesDetailsRequest.prototype.getId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetSeriesDetailsRequest} returns this
 */
proto.homeflix.GetSeriesDetailsRequest.prototype.setId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.SearchRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.SearchRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.SearchRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SearchRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    query: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 2, ""),
    limit: jspb.Message.getFieldWithDefault(msg, 3, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.SearchRequest}
 */
proto.homeflix.SearchRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.SearchRequest;
  return proto.homeflix.SearchRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.SearchRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.SearchRequest}
 */
proto.homeflix.SearchRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setQuery(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.SearchRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.SearchRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.SearchRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SearchRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getQuery();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
};


/**
 * optional string query = 1;
 * @return {string}
 */
proto.homeflix.SearchRequest.prototype.getQuery = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.SearchRequest} returns this
 */
proto.homeflix.SearchRequest.prototype.setQuery = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_type = 2;
 * @return {string}
 */
proto.homeflix.SearchRequest.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.SearchRequest} returns this
 */
proto.homeflix.SearchRequest.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int32 limit = 3;
 * @return {number}
 */
proto.homeflix.SearchRequest.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.SearchRequest} returns this
 */
proto.homeflix.SearchRequest.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.SearchResponse.repeatedFields_ = [1,2];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.SearchResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.SearchResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.SearchResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SearchResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    moviesList: jspb.Message.toObjectList(msg.getMoviesList(),
    proto.homeflix.Movie.toObject, includeInstance),
    seriesList: jspb.Message.toObjectList(msg.getSeriesList(),
    proto.homeflix.Series.toObject, includeInstance),
    totalResults: jspb.Message.getFieldWithDefault(msg, 3, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.SearchResponse}
 */
proto.homeflix.SearchResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.SearchResponse;
  return proto.homeflix.SearchResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.SearchResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.SearchResponse}
 */
proto.homeflix.SearchResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.homeflix.Movie;
      reader.readMessage(value,proto.homeflix.Movie.deserializeBinaryFromReader);
      msg.addMovies(value);
      break;
    case 2:
      var value = new proto.homeflix.Series;
      reader.readMessage(value,proto.homeflix.Series.deserializeBinaryFromReader);
      msg.addSeries(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalResults(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.SearchResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.SearchResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.SearchResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SearchResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMoviesList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.homeflix.Movie.serializeBinaryToWriter
    );
  }
  f = message.getSeriesList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      2,
      f,
      proto.homeflix.Series.serializeBinaryToWriter
    );
  }
  f = message.getTotalResults();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
};


/**
 * repeated Movie movies = 1;
 * @return {!Array<!proto.homeflix.Movie>}
 */
proto.homeflix.SearchResponse.prototype.getMoviesList = function() {
  return /** @type{!Array<!proto.homeflix.Movie>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.Movie, 1));
};


/**
 * @param {!Array<!proto.homeflix.Movie>} value
 * @return {!proto.homeflix.SearchResponse} returns this
*/
proto.homeflix.SearchResponse.prototype.setMoviesList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.homeflix.Movie=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Movie}
 */
proto.homeflix.SearchResponse.prototype.addMovies = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.homeflix.Movie, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.SearchResponse} returns this
 */
proto.homeflix.SearchResponse.prototype.clearMoviesList = function() {
  return this.setMoviesList([]);
};


/**
 * repeated Series series = 2;
 * @return {!Array<!proto.homeflix.Series>}
 */
proto.homeflix.SearchResponse.prototype.getSeriesList = function() {
  return /** @type{!Array<!proto.homeflix.Series>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.Series, 2));
};


/**
 * @param {!Array<!proto.homeflix.Series>} value
 * @return {!proto.homeflix.SearchResponse} returns this
*/
proto.homeflix.SearchResponse.prototype.setSeriesList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 2, value);
};


/**
 * @param {!proto.homeflix.Series=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Series}
 */
proto.homeflix.SearchResponse.prototype.addSeries = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 2, opt_value, proto.homeflix.Series, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.SearchResponse} returns this
 */
proto.homeflix.SearchResponse.prototype.clearSeriesList = function() {
  return this.setSeriesList([]);
};


/**
 * optional int32 total_results = 3;
 * @return {number}
 */
proto.homeflix.SearchResponse.prototype.getTotalResults = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.SearchResponse} returns this
 */
proto.homeflix.SearchResponse.prototype.setTotalResults = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetByGenreRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetByGenreRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetByGenreRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetByGenreRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    genre: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 2, ""),
    page: jspb.Message.getFieldWithDefault(msg, 3, 0),
    limit: jspb.Message.getFieldWithDefault(msg, 4, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetByGenreRequest}
 */
proto.homeflix.GetByGenreRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetByGenreRequest;
  return proto.homeflix.GetByGenreRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetByGenreRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetByGenreRequest}
 */
proto.homeflix.GetByGenreRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setGenre(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setPage(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetByGenreRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetByGenreRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetByGenreRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetByGenreRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getGenre();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getPage();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
};


/**
 * optional string genre = 1;
 * @return {string}
 */
proto.homeflix.GetByGenreRequest.prototype.getGenre = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetByGenreRequest} returns this
 */
proto.homeflix.GetByGenreRequest.prototype.setGenre = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_type = 2;
 * @return {string}
 */
proto.homeflix.GetByGenreRequest.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetByGenreRequest} returns this
 */
proto.homeflix.GetByGenreRequest.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int32 page = 3;
 * @return {number}
 */
proto.homeflix.GetByGenreRequest.prototype.getPage = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetByGenreRequest} returns this
 */
proto.homeflix.GetByGenreRequest.prototype.setPage = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional int32 limit = 4;
 * @return {number}
 */
proto.homeflix.GetByGenreRequest.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetByGenreRequest} returns this
 */
proto.homeflix.GetByGenreRequest.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetRecentRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetRecentRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetRecentRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetRecentRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    limit: jspb.Message.getFieldWithDefault(msg, 1, 0),
    mediaType: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetRecentRequest}
 */
proto.homeflix.GetRecentRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetRecentRequest;
  return proto.homeflix.GetRecentRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetRecentRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetRecentRequest}
 */
proto.homeflix.GetRecentRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetRecentRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetRecentRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetRecentRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetRecentRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional int32 limit = 1;
 * @return {number}
 */
proto.homeflix.GetRecentRequest.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetRecentRequest} returns this
 */
proto.homeflix.GetRecentRequest.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional string media_type = 2;
 * @return {string}
 */
proto.homeflix.GetRecentRequest.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetRecentRequest} returns this
 */
proto.homeflix.GetRecentRequest.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.MediaListResponse.repeatedFields_ = [1,2];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.MediaListResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.MediaListResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.MediaListResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.MediaListResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    moviesList: jspb.Message.toObjectList(msg.getMoviesList(),
    proto.homeflix.Movie.toObject, includeInstance),
    seriesList: jspb.Message.toObjectList(msg.getSeriesList(),
    proto.homeflix.Series.toObject, includeInstance),
    totalCount: jspb.Message.getFieldWithDefault(msg, 3, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.MediaListResponse}
 */
proto.homeflix.MediaListResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.MediaListResponse;
  return proto.homeflix.MediaListResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.MediaListResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.MediaListResponse}
 */
proto.homeflix.MediaListResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.homeflix.Movie;
      reader.readMessage(value,proto.homeflix.Movie.deserializeBinaryFromReader);
      msg.addMovies(value);
      break;
    case 2:
      var value = new proto.homeflix.Series;
      reader.readMessage(value,proto.homeflix.Series.deserializeBinaryFromReader);
      msg.addSeries(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalCount(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.MediaListResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.MediaListResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.MediaListResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.MediaListResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMoviesList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.homeflix.Movie.serializeBinaryToWriter
    );
  }
  f = message.getSeriesList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      2,
      f,
      proto.homeflix.Series.serializeBinaryToWriter
    );
  }
  f = message.getTotalCount();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
};


/**
 * repeated Movie movies = 1;
 * @return {!Array<!proto.homeflix.Movie>}
 */
proto.homeflix.MediaListResponse.prototype.getMoviesList = function() {
  return /** @type{!Array<!proto.homeflix.Movie>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.Movie, 1));
};


/**
 * @param {!Array<!proto.homeflix.Movie>} value
 * @return {!proto.homeflix.MediaListResponse} returns this
*/
proto.homeflix.MediaListResponse.prototype.setMoviesList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.homeflix.Movie=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Movie}
 */
proto.homeflix.MediaListResponse.prototype.addMovies = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.homeflix.Movie, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.MediaListResponse} returns this
 */
proto.homeflix.MediaListResponse.prototype.clearMoviesList = function() {
  return this.setMoviesList([]);
};


/**
 * repeated Series series = 2;
 * @return {!Array<!proto.homeflix.Series>}
 */
proto.homeflix.MediaListResponse.prototype.getSeriesList = function() {
  return /** @type{!Array<!proto.homeflix.Series>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.Series, 2));
};


/**
 * @param {!Array<!proto.homeflix.Series>} value
 * @return {!proto.homeflix.MediaListResponse} returns this
*/
proto.homeflix.MediaListResponse.prototype.setSeriesList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 2, value);
};


/**
 * @param {!proto.homeflix.Series=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.Series}
 */
proto.homeflix.MediaListResponse.prototype.addSeries = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 2, opt_value, proto.homeflix.Series, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.MediaListResponse} returns this
 */
proto.homeflix.MediaListResponse.prototype.clearSeriesList = function() {
  return this.setSeriesList([]);
};


/**
 * optional int32 total_count = 3;
 * @return {number}
 */
proto.homeflix.MediaListResponse.prototype.getTotalCount = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.MediaListResponse} returns this
 */
proto.homeflix.MediaListResponse.prototype.setTotalCount = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.StreamRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.StreamRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.StreamRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    mediaId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 2, ""),
    startByte: jspb.Message.getFieldWithDefault(msg, 3, 0),
    endByte: jspb.Message.getFieldWithDefault(msg, 4, 0),
    quality: jspb.Message.getFieldWithDefault(msg, 5, ""),
    transcodeAudio: jspb.Message.getBooleanFieldWithDefault(msg, 6, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.StreamRequest}
 */
proto.homeflix.StreamRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.StreamRequest;
  return proto.homeflix.StreamRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.StreamRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.StreamRequest}
 */
proto.homeflix.StreamRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setStartByte(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setEndByte(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setQuality(value);
      break;
    case 6:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setTranscodeAudio(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.StreamRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.StreamRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.StreamRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getStartByte();
  if (f !== 0) {
    writer.writeInt64(
      3,
      f
    );
  }
  f = message.getEndByte();
  if (f !== 0) {
    writer.writeInt64(
      4,
      f
    );
  }
  f = message.getQuality();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
  f = message.getTranscodeAudio();
  if (f) {
    writer.writeBool(
      6,
      f
    );
  }
};


/**
 * optional string media_id = 1;
 * @return {string}
 */
proto.homeflix.StreamRequest.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamRequest} returns this
 */
proto.homeflix.StreamRequest.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_type = 2;
 * @return {string}
 */
proto.homeflix.StreamRequest.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamRequest} returns this
 */
proto.homeflix.StreamRequest.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int64 start_byte = 3;
 * @return {number}
 */
proto.homeflix.StreamRequest.prototype.getStartByte = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamRequest} returns this
 */
proto.homeflix.StreamRequest.prototype.setStartByte = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional int64 end_byte = 4;
 * @return {number}
 */
proto.homeflix.StreamRequest.prototype.getEndByte = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamRequest} returns this
 */
proto.homeflix.StreamRequest.prototype.setEndByte = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional string quality = 5;
 * @return {string}
 */
proto.homeflix.StreamRequest.prototype.getQuality = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamRequest} returns this
 */
proto.homeflix.StreamRequest.prototype.setQuality = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};


/**
 * optional bool transcode_audio = 6;
 * @return {boolean}
 */
proto.homeflix.StreamRequest.prototype.getTranscodeAudio = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 6, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.StreamRequest} returns this
 */
proto.homeflix.StreamRequest.prototype.setTranscodeAudio = function(value) {
  return jspb.Message.setProto3BooleanField(this, 6, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.StreamChunk.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.StreamChunk.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.StreamChunk} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamChunk.toObject = function(includeInstance, msg) {
  var f, obj = {
    data: msg.getData_asB64(),
    chunkSize: jspb.Message.getFieldWithDefault(msg, 2, 0),
    totalSize: jspb.Message.getFieldWithDefault(msg, 3, 0),
    contentType: jspb.Message.getFieldWithDefault(msg, 4, ""),
    headersMap: (f = msg.getHeadersMap()) ? f.toObject(includeInstance, undefined) : []
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.StreamChunk}
 */
proto.homeflix.StreamChunk.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.StreamChunk;
  return proto.homeflix.StreamChunk.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.StreamChunk} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.StreamChunk}
 */
proto.homeflix.StreamChunk.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {!Uint8Array} */ (reader.readBytes());
      msg.setData(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setChunkSize(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setTotalSize(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setContentType(value);
      break;
    case 5:
      var value = msg.getHeadersMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readString, null, "", "");
         });
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.StreamChunk.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.StreamChunk.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.StreamChunk} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamChunk.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getData_asU8();
  if (f.length > 0) {
    writer.writeBytes(
      1,
      f
    );
  }
  f = message.getChunkSize();
  if (f !== 0) {
    writer.writeInt64(
      2,
      f
    );
  }
  f = message.getTotalSize();
  if (f !== 0) {
    writer.writeInt64(
      3,
      f
    );
  }
  f = message.getContentType();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getHeadersMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(5, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeString);
  }
};


/**
 * optional bytes data = 1;
 * @return {!(string|Uint8Array)}
 */
proto.homeflix.StreamChunk.prototype.getData = function() {
  return /** @type {!(string|Uint8Array)} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * optional bytes data = 1;
 * This is a type-conversion wrapper around `getData()`
 * @return {string}
 */
proto.homeflix.StreamChunk.prototype.getData_asB64 = function() {
  return /** @type {string} */ (jspb.Message.bytesAsB64(
      this.getData()));
};


/**
 * optional bytes data = 1;
 * Note that Uint8Array is not supported on all browsers.
 * @see http://caniuse.com/Uint8Array
 * This is a type-conversion wrapper around `getData()`
 * @return {!Uint8Array}
 */
proto.homeflix.StreamChunk.prototype.getData_asU8 = function() {
  return /** @type {!Uint8Array} */ (jspb.Message.bytesAsU8(
      this.getData()));
};


/**
 * @param {!(string|Uint8Array)} value
 * @return {!proto.homeflix.StreamChunk} returns this
 */
proto.homeflix.StreamChunk.prototype.setData = function(value) {
  return jspb.Message.setProto3BytesField(this, 1, value);
};


/**
 * optional int64 chunk_size = 2;
 * @return {number}
 */
proto.homeflix.StreamChunk.prototype.getChunkSize = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamChunk} returns this
 */
proto.homeflix.StreamChunk.prototype.setChunkSize = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional int64 total_size = 3;
 * @return {number}
 */
proto.homeflix.StreamChunk.prototype.getTotalSize = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamChunk} returns this
 */
proto.homeflix.StreamChunk.prototype.setTotalSize = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional string content_type = 4;
 * @return {string}
 */
proto.homeflix.StreamChunk.prototype.getContentType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamChunk} returns this
 */
proto.homeflix.StreamChunk.prototype.setContentType = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * map<string, string> headers = 5;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,string>}
 */
proto.homeflix.StreamChunk.prototype.getHeadersMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,string>} */ (
      jspb.Message.getMapField(this, 5, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.homeflix.StreamChunk} returns this
 */
proto.homeflix.StreamChunk.prototype.clearHeadersMap = function() {
  this.getHeadersMap().clear();
  return this;};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.StreamInfoRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.StreamInfoRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.StreamInfoRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamInfoRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    mediaId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.StreamInfoRequest}
 */
proto.homeflix.StreamInfoRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.StreamInfoRequest;
  return proto.homeflix.StreamInfoRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.StreamInfoRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.StreamInfoRequest}
 */
proto.homeflix.StreamInfoRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.StreamInfoRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.StreamInfoRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.StreamInfoRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamInfoRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional string media_id = 1;
 * @return {string}
 */
proto.homeflix.StreamInfoRequest.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamInfoRequest} returns this
 */
proto.homeflix.StreamInfoRequest.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_type = 2;
 * @return {string}
 */
proto.homeflix.StreamInfoRequest.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamInfoRequest} returns this
 */
proto.homeflix.StreamInfoRequest.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.StreamInfo.repeatedFields_ = [7,8,9];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.StreamInfo.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.StreamInfo.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.StreamInfo} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamInfo.toObject = function(includeInstance, msg) {
  var f, obj = {
    videoCodec: jspb.Message.getFieldWithDefault(msg, 1, ""),
    audioCodec: jspb.Message.getFieldWithDefault(msg, 2, ""),
    resolution: jspb.Message.getFieldWithDefault(msg, 3, ""),
    bitrate: jspb.Message.getFieldWithDefault(msg, 4, 0),
    duration: jspb.Message.getFieldWithDefault(msg, 5, 0),
    needsTranscoding: jspb.Message.getBooleanFieldWithDefault(msg, 6, false),
    availableQualitiesList: (f = jspb.Message.getRepeatedField(msg, 7)) == null ? undefined : f,
    audioTracksList: jspb.Message.toObjectList(msg.getAudioTracksList(),
    proto.homeflix.AudioTrack.toObject, includeInstance),
    subtitleTracksList: jspb.Message.toObjectList(msg.getSubtitleTracksList(),
    proto.homeflix.SubtitleTrack.toObject, includeInstance)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.StreamInfo}
 */
proto.homeflix.StreamInfo.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.StreamInfo;
  return proto.homeflix.StreamInfo.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.StreamInfo} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.StreamInfo}
 */
proto.homeflix.StreamInfo.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setVideoCodec(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setAudioCodec(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setResolution(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setBitrate(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setDuration(value);
      break;
    case 6:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setNeedsTranscoding(value);
      break;
    case 7:
      var value = /** @type {string} */ (reader.readString());
      msg.addAvailableQualities(value);
      break;
    case 8:
      var value = new proto.homeflix.AudioTrack;
      reader.readMessage(value,proto.homeflix.AudioTrack.deserializeBinaryFromReader);
      msg.addAudioTracks(value);
      break;
    case 9:
      var value = new proto.homeflix.SubtitleTrack;
      reader.readMessage(value,proto.homeflix.SubtitleTrack.deserializeBinaryFromReader);
      msg.addSubtitleTracks(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.StreamInfo.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.StreamInfo.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.StreamInfo} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamInfo.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getVideoCodec();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getAudioCodec();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getResolution();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getBitrate();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
  f = message.getDuration();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
  f = message.getNeedsTranscoding();
  if (f) {
    writer.writeBool(
      6,
      f
    );
  }
  f = message.getAvailableQualitiesList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      7,
      f
    );
  }
  f = message.getAudioTracksList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      8,
      f,
      proto.homeflix.AudioTrack.serializeBinaryToWriter
    );
  }
  f = message.getSubtitleTracksList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      9,
      f,
      proto.homeflix.SubtitleTrack.serializeBinaryToWriter
    );
  }
};


/**
 * optional string video_codec = 1;
 * @return {string}
 */
proto.homeflix.StreamInfo.prototype.getVideoCodec = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.setVideoCodec = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string audio_codec = 2;
 * @return {string}
 */
proto.homeflix.StreamInfo.prototype.getAudioCodec = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.setAudioCodec = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string resolution = 3;
 * @return {string}
 */
proto.homeflix.StreamInfo.prototype.getResolution = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.setResolution = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional int32 bitrate = 4;
 * @return {number}
 */
proto.homeflix.StreamInfo.prototype.getBitrate = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.setBitrate = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional int32 duration = 5;
 * @return {number}
 */
proto.homeflix.StreamInfo.prototype.getDuration = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.setDuration = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


/**
 * optional bool needs_transcoding = 6;
 * @return {boolean}
 */
proto.homeflix.StreamInfo.prototype.getNeedsTranscoding = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 6, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.setNeedsTranscoding = function(value) {
  return jspb.Message.setProto3BooleanField(this, 6, value);
};


/**
 * repeated string available_qualities = 7;
 * @return {!Array<string>}
 */
proto.homeflix.StreamInfo.prototype.getAvailableQualitiesList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 7));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.setAvailableQualitiesList = function(value) {
  return jspb.Message.setField(this, 7, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.addAvailableQualities = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 7, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.clearAvailableQualitiesList = function() {
  return this.setAvailableQualitiesList([]);
};


/**
 * repeated AudioTrack audio_tracks = 8;
 * @return {!Array<!proto.homeflix.AudioTrack>}
 */
proto.homeflix.StreamInfo.prototype.getAudioTracksList = function() {
  return /** @type{!Array<!proto.homeflix.AudioTrack>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.AudioTrack, 8));
};


/**
 * @param {!Array<!proto.homeflix.AudioTrack>} value
 * @return {!proto.homeflix.StreamInfo} returns this
*/
proto.homeflix.StreamInfo.prototype.setAudioTracksList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 8, value);
};


/**
 * @param {!proto.homeflix.AudioTrack=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.AudioTrack}
 */
proto.homeflix.StreamInfo.prototype.addAudioTracks = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 8, opt_value, proto.homeflix.AudioTrack, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.clearAudioTracksList = function() {
  return this.setAudioTracksList([]);
};


/**
 * repeated SubtitleTrack subtitle_tracks = 9;
 * @return {!Array<!proto.homeflix.SubtitleTrack>}
 */
proto.homeflix.StreamInfo.prototype.getSubtitleTracksList = function() {
  return /** @type{!Array<!proto.homeflix.SubtitleTrack>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.SubtitleTrack, 9));
};


/**
 * @param {!Array<!proto.homeflix.SubtitleTrack>} value
 * @return {!proto.homeflix.StreamInfo} returns this
*/
proto.homeflix.StreamInfo.prototype.setSubtitleTracksList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 9, value);
};


/**
 * @param {!proto.homeflix.SubtitleTrack=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.SubtitleTrack}
 */
proto.homeflix.StreamInfo.prototype.addSubtitleTracks = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 9, opt_value, proto.homeflix.SubtitleTrack, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.StreamInfo} returns this
 */
proto.homeflix.StreamInfo.prototype.clearSubtitleTracksList = function() {
  return this.setSubtitleTracksList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.AudioTrack.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.AudioTrack.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.AudioTrack} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.AudioTrack.toObject = function(includeInstance, msg) {
  var f, obj = {
    index: jspb.Message.getFieldWithDefault(msg, 1, 0),
    codec: jspb.Message.getFieldWithDefault(msg, 2, ""),
    language: jspb.Message.getFieldWithDefault(msg, 3, ""),
    channels: jspb.Message.getFieldWithDefault(msg, 4, 0),
    sampleRate: jspb.Message.getFieldWithDefault(msg, 5, 0),
    isDefault: jspb.Message.getBooleanFieldWithDefault(msg, 6, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.AudioTrack}
 */
proto.homeflix.AudioTrack.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.AudioTrack;
  return proto.homeflix.AudioTrack.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.AudioTrack} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.AudioTrack}
 */
proto.homeflix.AudioTrack.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setIndex(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setCodec(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setLanguage(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setChannels(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setSampleRate(value);
      break;
    case 6:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setIsDefault(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.AudioTrack.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.AudioTrack.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.AudioTrack} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.AudioTrack.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getIndex();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getCodec();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getLanguage();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getChannels();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
  f = message.getSampleRate();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
  f = message.getIsDefault();
  if (f) {
    writer.writeBool(
      6,
      f
    );
  }
};


/**
 * optional int32 index = 1;
 * @return {number}
 */
proto.homeflix.AudioTrack.prototype.getIndex = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.AudioTrack} returns this
 */
proto.homeflix.AudioTrack.prototype.setIndex = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional string codec = 2;
 * @return {string}
 */
proto.homeflix.AudioTrack.prototype.getCodec = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.AudioTrack} returns this
 */
proto.homeflix.AudioTrack.prototype.setCodec = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string language = 3;
 * @return {string}
 */
proto.homeflix.AudioTrack.prototype.getLanguage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.AudioTrack} returns this
 */
proto.homeflix.AudioTrack.prototype.setLanguage = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional int32 channels = 4;
 * @return {number}
 */
proto.homeflix.AudioTrack.prototype.getChannels = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.AudioTrack} returns this
 */
proto.homeflix.AudioTrack.prototype.setChannels = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional int32 sample_rate = 5;
 * @return {number}
 */
proto.homeflix.AudioTrack.prototype.getSampleRate = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.AudioTrack} returns this
 */
proto.homeflix.AudioTrack.prototype.setSampleRate = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


/**
 * optional bool is_default = 6;
 * @return {boolean}
 */
proto.homeflix.AudioTrack.prototype.getIsDefault = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 6, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.AudioTrack} returns this
 */
proto.homeflix.AudioTrack.prototype.setIsDefault = function(value) {
  return jspb.Message.setProto3BooleanField(this, 6, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.SubtitleTrack.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.SubtitleTrack.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.SubtitleTrack} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SubtitleTrack.toObject = function(includeInstance, msg) {
  var f, obj = {
    index: jspb.Message.getFieldWithDefault(msg, 1, 0),
    language: jspb.Message.getFieldWithDefault(msg, 2, ""),
    format: jspb.Message.getFieldWithDefault(msg, 3, ""),
    isDefault: jspb.Message.getBooleanFieldWithDefault(msg, 4, false),
    isForced: jspb.Message.getBooleanFieldWithDefault(msg, 5, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.SubtitleTrack}
 */
proto.homeflix.SubtitleTrack.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.SubtitleTrack;
  return proto.homeflix.SubtitleTrack.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.SubtitleTrack} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.SubtitleTrack}
 */
proto.homeflix.SubtitleTrack.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setIndex(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setLanguage(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setFormat(value);
      break;
    case 4:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setIsDefault(value);
      break;
    case 5:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setIsForced(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.SubtitleTrack.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.SubtitleTrack.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.SubtitleTrack} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SubtitleTrack.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getIndex();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getLanguage();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getFormat();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getIsDefault();
  if (f) {
    writer.writeBool(
      4,
      f
    );
  }
  f = message.getIsForced();
  if (f) {
    writer.writeBool(
      5,
      f
    );
  }
};


/**
 * optional int32 index = 1;
 * @return {number}
 */
proto.homeflix.SubtitleTrack.prototype.getIndex = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.SubtitleTrack} returns this
 */
proto.homeflix.SubtitleTrack.prototype.setIndex = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional string language = 2;
 * @return {string}
 */
proto.homeflix.SubtitleTrack.prototype.getLanguage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.SubtitleTrack} returns this
 */
proto.homeflix.SubtitleTrack.prototype.setLanguage = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string format = 3;
 * @return {string}
 */
proto.homeflix.SubtitleTrack.prototype.getFormat = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.SubtitleTrack} returns this
 */
proto.homeflix.SubtitleTrack.prototype.setFormat = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional bool is_default = 4;
 * @return {boolean}
 */
proto.homeflix.SubtitleTrack.prototype.getIsDefault = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 4, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.SubtitleTrack} returns this
 */
proto.homeflix.SubtitleTrack.prototype.setIsDefault = function(value) {
  return jspb.Message.setProto3BooleanField(this, 4, value);
};


/**
 * optional bool is_forced = 5;
 * @return {boolean}
 */
proto.homeflix.SubtitleTrack.prototype.getIsForced = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 5, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.SubtitleTrack} returns this
 */
proto.homeflix.SubtitleTrack.prototype.setIsForced = function(value) {
  return jspb.Message.setProto3BooleanField(this, 5, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PreviewRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PreviewRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PreviewRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    mediaId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 2, ""),
    duration: jspb.Message.getFieldWithDefault(msg, 3, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PreviewRequest}
 */
proto.homeflix.PreviewRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PreviewRequest;
  return proto.homeflix.PreviewRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PreviewRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PreviewRequest}
 */
proto.homeflix.PreviewRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setDuration(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PreviewRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PreviewRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PreviewRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getDuration();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
};


/**
 * optional string media_id = 1;
 * @return {string}
 */
proto.homeflix.PreviewRequest.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewRequest} returns this
 */
proto.homeflix.PreviewRequest.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_type = 2;
 * @return {string}
 */
proto.homeflix.PreviewRequest.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewRequest} returns this
 */
proto.homeflix.PreviewRequest.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int32 duration = 3;
 * @return {number}
 */
proto.homeflix.PreviewRequest.prototype.getDuration = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.PreviewRequest} returns this
 */
proto.homeflix.PreviewRequest.prototype.setDuration = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GeneratePreviewRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GeneratePreviewRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GeneratePreviewRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GeneratePreviewRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    mediaId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 2, ""),
    duration: jspb.Message.getFieldWithDefault(msg, 3, 0),
    highPriority: jspb.Message.getBooleanFieldWithDefault(msg, 4, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GeneratePreviewRequest}
 */
proto.homeflix.GeneratePreviewRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GeneratePreviewRequest;
  return proto.homeflix.GeneratePreviewRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GeneratePreviewRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GeneratePreviewRequest}
 */
proto.homeflix.GeneratePreviewRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setDuration(value);
      break;
    case 4:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setHighPriority(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GeneratePreviewRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GeneratePreviewRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GeneratePreviewRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GeneratePreviewRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getDuration();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getHighPriority();
  if (f) {
    writer.writeBool(
      4,
      f
    );
  }
};


/**
 * optional string media_id = 1;
 * @return {string}
 */
proto.homeflix.GeneratePreviewRequest.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GeneratePreviewRequest} returns this
 */
proto.homeflix.GeneratePreviewRequest.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_type = 2;
 * @return {string}
 */
proto.homeflix.GeneratePreviewRequest.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GeneratePreviewRequest} returns this
 */
proto.homeflix.GeneratePreviewRequest.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int32 duration = 3;
 * @return {number}
 */
proto.homeflix.GeneratePreviewRequest.prototype.getDuration = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GeneratePreviewRequest} returns this
 */
proto.homeflix.GeneratePreviewRequest.prototype.setDuration = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional bool high_priority = 4;
 * @return {boolean}
 */
proto.homeflix.GeneratePreviewRequest.prototype.getHighPriority = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 4, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.GeneratePreviewRequest} returns this
 */
proto.homeflix.GeneratePreviewRequest.prototype.setHighPriority = function(value) {
  return jspb.Message.setProto3BooleanField(this, 4, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GeneratePreviewResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GeneratePreviewResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GeneratePreviewResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GeneratePreviewResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    jobId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    status: jspb.Message.getFieldWithDefault(msg, 2, ""),
    previewUrl: jspb.Message.getFieldWithDefault(msg, 3, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GeneratePreviewResponse}
 */
proto.homeflix.GeneratePreviewResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GeneratePreviewResponse;
  return proto.homeflix.GeneratePreviewResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GeneratePreviewResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GeneratePreviewResponse}
 */
proto.homeflix.GeneratePreviewResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setJobId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setStatus(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setPreviewUrl(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GeneratePreviewResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GeneratePreviewResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GeneratePreviewResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GeneratePreviewResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getJobId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getStatus();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getPreviewUrl();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
};


/**
 * optional string job_id = 1;
 * @return {string}
 */
proto.homeflix.GeneratePreviewResponse.prototype.getJobId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GeneratePreviewResponse} returns this
 */
proto.homeflix.GeneratePreviewResponse.prototype.setJobId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string status = 2;
 * @return {string}
 */
proto.homeflix.GeneratePreviewResponse.prototype.getStatus = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GeneratePreviewResponse} returns this
 */
proto.homeflix.GeneratePreviewResponse.prototype.setStatus = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string preview_url = 3;
 * @return {string}
 */
proto.homeflix.GeneratePreviewResponse.prototype.getPreviewUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GeneratePreviewResponse} returns this
 */
proto.homeflix.GeneratePreviewResponse.prototype.setPreviewUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PreviewStatusRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PreviewStatusRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PreviewStatusRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewStatusRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    jobId: jspb.Message.getFieldWithDefault(msg, 1, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PreviewStatusRequest}
 */
proto.homeflix.PreviewStatusRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PreviewStatusRequest;
  return proto.homeflix.PreviewStatusRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PreviewStatusRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PreviewStatusRequest}
 */
proto.homeflix.PreviewStatusRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setJobId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PreviewStatusRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PreviewStatusRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PreviewStatusRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewStatusRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getJobId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string job_id = 1;
 * @return {string}
 */
proto.homeflix.PreviewStatusRequest.prototype.getJobId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewStatusRequest} returns this
 */
proto.homeflix.PreviewStatusRequest.prototype.setJobId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PreviewStatus.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PreviewStatus.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PreviewStatus} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewStatus.toObject = function(includeInstance, msg) {
  var f, obj = {
    jobId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    status: jspb.Message.getFieldWithDefault(msg, 2, ""),
    progressPercent: jspb.Message.getFieldWithDefault(msg, 3, 0),
    errorMessage: jspb.Message.getFieldWithDefault(msg, 4, ""),
    previewUrl: jspb.Message.getFieldWithDefault(msg, 5, ""),
    createdAt: (f = msg.getCreatedAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    updatedAt: (f = msg.getUpdatedAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PreviewStatus}
 */
proto.homeflix.PreviewStatus.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PreviewStatus;
  return proto.homeflix.PreviewStatus.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PreviewStatus} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PreviewStatus}
 */
proto.homeflix.PreviewStatus.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setJobId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setStatus(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setProgressPercent(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setErrorMessage(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setPreviewUrl(value);
      break;
    case 6:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setCreatedAt(value);
      break;
    case 7:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setUpdatedAt(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PreviewStatus.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PreviewStatus.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PreviewStatus} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewStatus.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getJobId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getStatus();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getProgressPercent();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getErrorMessage();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getPreviewUrl();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
  f = message.getCreatedAt();
  if (f != null) {
    writer.writeMessage(
      6,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getUpdatedAt();
  if (f != null) {
    writer.writeMessage(
      7,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
};


/**
 * optional string job_id = 1;
 * @return {string}
 */
proto.homeflix.PreviewStatus.prototype.getJobId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewStatus} returns this
 */
proto.homeflix.PreviewStatus.prototype.setJobId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string status = 2;
 * @return {string}
 */
proto.homeflix.PreviewStatus.prototype.getStatus = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewStatus} returns this
 */
proto.homeflix.PreviewStatus.prototype.setStatus = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int32 progress_percent = 3;
 * @return {number}
 */
proto.homeflix.PreviewStatus.prototype.getProgressPercent = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.PreviewStatus} returns this
 */
proto.homeflix.PreviewStatus.prototype.setProgressPercent = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional string error_message = 4;
 * @return {string}
 */
proto.homeflix.PreviewStatus.prototype.getErrorMessage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewStatus} returns this
 */
proto.homeflix.PreviewStatus.prototype.setErrorMessage = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional string preview_url = 5;
 * @return {string}
 */
proto.homeflix.PreviewStatus.prototype.getPreviewUrl = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewStatus} returns this
 */
proto.homeflix.PreviewStatus.prototype.setPreviewUrl = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};


/**
 * optional google.protobuf.Timestamp created_at = 6;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.PreviewStatus.prototype.getCreatedAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 6));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.PreviewStatus} returns this
*/
proto.homeflix.PreviewStatus.prototype.setCreatedAt = function(value) {
  return jspb.Message.setWrapperField(this, 6, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.PreviewStatus} returns this
 */
proto.homeflix.PreviewStatus.prototype.clearCreatedAt = function() {
  return this.setCreatedAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.PreviewStatus.prototype.hasCreatedAt = function() {
  return jspb.Message.getField(this, 6) != null;
};


/**
 * optional google.protobuf.Timestamp updated_at = 7;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.PreviewStatus.prototype.getUpdatedAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 7));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.PreviewStatus} returns this
*/
proto.homeflix.PreviewStatus.prototype.setUpdatedAt = function(value) {
  return jspb.Message.setWrapperField(this, 7, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.PreviewStatus} returns this
 */
proto.homeflix.PreviewStatus.prototype.clearUpdatedAt = function() {
  return this.setUpdatedAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.PreviewStatus.prototype.hasUpdatedAt = function() {
  return jspb.Message.getField(this, 7) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PreviewProgressRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PreviewProgressRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PreviewProgressRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewProgressRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    jobId: jspb.Message.getFieldWithDefault(msg, 1, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PreviewProgressRequest}
 */
proto.homeflix.PreviewProgressRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PreviewProgressRequest;
  return proto.homeflix.PreviewProgressRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PreviewProgressRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PreviewProgressRequest}
 */
proto.homeflix.PreviewProgressRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setJobId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PreviewProgressRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PreviewProgressRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PreviewProgressRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewProgressRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getJobId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string job_id = 1;
 * @return {string}
 */
proto.homeflix.PreviewProgressRequest.prototype.getJobId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewProgressRequest} returns this
 */
proto.homeflix.PreviewProgressRequest.prototype.setJobId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PreviewProgress.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PreviewProgress.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PreviewProgress} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewProgress.toObject = function(includeInstance, msg) {
  var f, obj = {
    jobId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    progressPercent: jspb.Message.getFieldWithDefault(msg, 2, 0),
    currentStage: jspb.Message.getFieldWithDefault(msg, 3, ""),
    status: jspb.Message.getFieldWithDefault(msg, 4, ""),
    errorMessage: jspb.Message.getFieldWithDefault(msg, 5, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PreviewProgress}
 */
proto.homeflix.PreviewProgress.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PreviewProgress;
  return proto.homeflix.PreviewProgress.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PreviewProgress} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PreviewProgress}
 */
proto.homeflix.PreviewProgress.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setJobId(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setProgressPercent(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setCurrentStage(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setStatus(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setErrorMessage(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PreviewProgress.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PreviewProgress.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PreviewProgress} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewProgress.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getJobId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getProgressPercent();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getCurrentStage();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getStatus();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getErrorMessage();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
};


/**
 * optional string job_id = 1;
 * @return {string}
 */
proto.homeflix.PreviewProgress.prototype.getJobId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewProgress} returns this
 */
proto.homeflix.PreviewProgress.prototype.setJobId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 progress_percent = 2;
 * @return {number}
 */
proto.homeflix.PreviewProgress.prototype.getProgressPercent = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.PreviewProgress} returns this
 */
proto.homeflix.PreviewProgress.prototype.setProgressPercent = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional string current_stage = 3;
 * @return {string}
 */
proto.homeflix.PreviewProgress.prototype.getCurrentStage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewProgress} returns this
 */
proto.homeflix.PreviewProgress.prototype.setCurrentStage = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string status = 4;
 * @return {string}
 */
proto.homeflix.PreviewProgress.prototype.getStatus = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewProgress} returns this
 */
proto.homeflix.PreviewProgress.prototype.setStatus = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional string error_message = 5;
 * @return {string}
 */
proto.homeflix.PreviewProgress.prototype.getErrorMessage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewProgress} returns this
 */
proto.homeflix.PreviewProgress.prototype.setErrorMessage = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.PreviewQueueStatus.repeatedFields_ = [3];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PreviewQueueStatus.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PreviewQueueStatus.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PreviewQueueStatus} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewQueueStatus.toObject = function(includeInstance, msg) {
  var f, obj = {
    queueLength: jspb.Message.getFieldWithDefault(msg, 1, 0),
    processingCount: jspb.Message.getFieldWithDefault(msg, 2, 0),
    currentJobsList: jspb.Message.toObjectList(msg.getCurrentJobsList(),
    proto.homeflix.PreviewJob.toObject, includeInstance)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PreviewQueueStatus}
 */
proto.homeflix.PreviewQueueStatus.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PreviewQueueStatus;
  return proto.homeflix.PreviewQueueStatus.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PreviewQueueStatus} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PreviewQueueStatus}
 */
proto.homeflix.PreviewQueueStatus.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setQueueLength(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setProcessingCount(value);
      break;
    case 3:
      var value = new proto.homeflix.PreviewJob;
      reader.readMessage(value,proto.homeflix.PreviewJob.deserializeBinaryFromReader);
      msg.addCurrentJobs(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PreviewQueueStatus.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PreviewQueueStatus.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PreviewQueueStatus} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewQueueStatus.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getQueueLength();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getProcessingCount();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getCurrentJobsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      3,
      f,
      proto.homeflix.PreviewJob.serializeBinaryToWriter
    );
  }
};


/**
 * optional int32 queue_length = 1;
 * @return {number}
 */
proto.homeflix.PreviewQueueStatus.prototype.getQueueLength = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.PreviewQueueStatus} returns this
 */
proto.homeflix.PreviewQueueStatus.prototype.setQueueLength = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional int32 processing_count = 2;
 * @return {number}
 */
proto.homeflix.PreviewQueueStatus.prototype.getProcessingCount = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.PreviewQueueStatus} returns this
 */
proto.homeflix.PreviewQueueStatus.prototype.setProcessingCount = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * repeated PreviewJob current_jobs = 3;
 * @return {!Array<!proto.homeflix.PreviewJob>}
 */
proto.homeflix.PreviewQueueStatus.prototype.getCurrentJobsList = function() {
  return /** @type{!Array<!proto.homeflix.PreviewJob>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.PreviewJob, 3));
};


/**
 * @param {!Array<!proto.homeflix.PreviewJob>} value
 * @return {!proto.homeflix.PreviewQueueStatus} returns this
*/
proto.homeflix.PreviewQueueStatus.prototype.setCurrentJobsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 3, value);
};


/**
 * @param {!proto.homeflix.PreviewJob=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.PreviewJob}
 */
proto.homeflix.PreviewQueueStatus.prototype.addCurrentJobs = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 3, opt_value, proto.homeflix.PreviewJob, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.PreviewQueueStatus} returns this
 */
proto.homeflix.PreviewQueueStatus.prototype.clearCurrentJobsList = function() {
  return this.setCurrentJobsList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PreviewJob.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PreviewJob.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PreviewJob} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewJob.toObject = function(includeInstance, msg) {
  var f, obj = {
    jobId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 3, ""),
    status: jspb.Message.getFieldWithDefault(msg, 4, ""),
    progressPercent: jspb.Message.getFieldWithDefault(msg, 5, 0),
    createdAt: (f = msg.getCreatedAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    highPriority: jspb.Message.getBooleanFieldWithDefault(msg, 7, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PreviewJob}
 */
proto.homeflix.PreviewJob.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PreviewJob;
  return proto.homeflix.PreviewJob.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PreviewJob} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PreviewJob}
 */
proto.homeflix.PreviewJob.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setJobId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setStatus(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setProgressPercent(value);
      break;
    case 6:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setCreatedAt(value);
      break;
    case 7:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setHighPriority(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PreviewJob.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PreviewJob.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PreviewJob} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PreviewJob.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getJobId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getStatus();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getProgressPercent();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
  f = message.getCreatedAt();
  if (f != null) {
    writer.writeMessage(
      6,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getHighPriority();
  if (f) {
    writer.writeBool(
      7,
      f
    );
  }
};


/**
 * optional string job_id = 1;
 * @return {string}
 */
proto.homeflix.PreviewJob.prototype.getJobId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewJob} returns this
 */
proto.homeflix.PreviewJob.prototype.setJobId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_id = 2;
 * @return {string}
 */
proto.homeflix.PreviewJob.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewJob} returns this
 */
proto.homeflix.PreviewJob.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string media_type = 3;
 * @return {string}
 */
proto.homeflix.PreviewJob.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewJob} returns this
 */
proto.homeflix.PreviewJob.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string status = 4;
 * @return {string}
 */
proto.homeflix.PreviewJob.prototype.getStatus = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PreviewJob} returns this
 */
proto.homeflix.PreviewJob.prototype.setStatus = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional int32 progress_percent = 5;
 * @return {number}
 */
proto.homeflix.PreviewJob.prototype.getProgressPercent = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.PreviewJob} returns this
 */
proto.homeflix.PreviewJob.prototype.setProgressPercent = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


/**
 * optional google.protobuf.Timestamp created_at = 6;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.PreviewJob.prototype.getCreatedAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 6));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.PreviewJob} returns this
*/
proto.homeflix.PreviewJob.prototype.setCreatedAt = function(value) {
  return jspb.Message.setWrapperField(this, 6, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.PreviewJob} returns this
 */
proto.homeflix.PreviewJob.prototype.clearCreatedAt = function() {
  return this.setCreatedAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.PreviewJob.prototype.hasCreatedAt = function() {
  return jspb.Message.getField(this, 6) != null;
};


/**
 * optional bool high_priority = 7;
 * @return {boolean}
 */
proto.homeflix.PreviewJob.prototype.getHighPriority = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 7, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.PreviewJob} returns this
 */
proto.homeflix.PreviewJob.prototype.setHighPriority = function(value) {
  return jspb.Message.setProto3BooleanField(this, 7, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.LoginRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.LoginRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.LoginRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.LoginRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    username: jspb.Message.getFieldWithDefault(msg, 1, ""),
    password: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.LoginRequest}
 */
proto.homeflix.LoginRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.LoginRequest;
  return proto.homeflix.LoginRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.LoginRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.LoginRequest}
 */
proto.homeflix.LoginRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUsername(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setPassword(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.LoginRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.LoginRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.LoginRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.LoginRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUsername();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getPassword();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional string username = 1;
 * @return {string}
 */
proto.homeflix.LoginRequest.prototype.getUsername = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.LoginRequest} returns this
 */
proto.homeflix.LoginRequest.prototype.setUsername = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string password = 2;
 * @return {string}
 */
proto.homeflix.LoginRequest.prototype.getPassword = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.LoginRequest} returns this
 */
proto.homeflix.LoginRequest.prototype.setPassword = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.LoginResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.LoginResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.LoginResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.LoginResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    accessToken: jspb.Message.getFieldWithDefault(msg, 1, ""),
    refreshToken: jspb.Message.getFieldWithDefault(msg, 2, ""),
    user: (f = msg.getUser()) && proto.homeflix.User.toObject(includeInstance, f),
    expiresAt: (f = msg.getExpiresAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.LoginResponse}
 */
proto.homeflix.LoginResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.LoginResponse;
  return proto.homeflix.LoginResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.LoginResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.LoginResponse}
 */
proto.homeflix.LoginResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setAccessToken(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setRefreshToken(value);
      break;
    case 3:
      var value = new proto.homeflix.User;
      reader.readMessage(value,proto.homeflix.User.deserializeBinaryFromReader);
      msg.setUser(value);
      break;
    case 4:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setExpiresAt(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.LoginResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.LoginResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.LoginResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.LoginResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getAccessToken();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getRefreshToken();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getUser();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.homeflix.User.serializeBinaryToWriter
    );
  }
  f = message.getExpiresAt();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
};


/**
 * optional string access_token = 1;
 * @return {string}
 */
proto.homeflix.LoginResponse.prototype.getAccessToken = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.LoginResponse} returns this
 */
proto.homeflix.LoginResponse.prototype.setAccessToken = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string refresh_token = 2;
 * @return {string}
 */
proto.homeflix.LoginResponse.prototype.getRefreshToken = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.LoginResponse} returns this
 */
proto.homeflix.LoginResponse.prototype.setRefreshToken = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional User user = 3;
 * @return {?proto.homeflix.User}
 */
proto.homeflix.LoginResponse.prototype.getUser = function() {
  return /** @type{?proto.homeflix.User} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.User, 3));
};


/**
 * @param {?proto.homeflix.User|undefined} value
 * @return {!proto.homeflix.LoginResponse} returns this
*/
proto.homeflix.LoginResponse.prototype.setUser = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.LoginResponse} returns this
 */
proto.homeflix.LoginResponse.prototype.clearUser = function() {
  return this.setUser(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.LoginResponse.prototype.hasUser = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional google.protobuf.Timestamp expires_at = 4;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.LoginResponse.prototype.getExpiresAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 4));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.LoginResponse} returns this
*/
proto.homeflix.LoginResponse.prototype.setExpiresAt = function(value) {
  return jspb.Message.setWrapperField(this, 4, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.LoginResponse} returns this
 */
proto.homeflix.LoginResponse.prototype.clearExpiresAt = function() {
  return this.setExpiresAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.LoginResponse.prototype.hasExpiresAt = function() {
  return jspb.Message.getField(this, 4) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RegisterRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RegisterRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RegisterRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RegisterRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    username: jspb.Message.getFieldWithDefault(msg, 1, ""),
    email: jspb.Message.getFieldWithDefault(msg, 2, ""),
    password: jspb.Message.getFieldWithDefault(msg, 3, ""),
    fullName: jspb.Message.getFieldWithDefault(msg, 4, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RegisterRequest}
 */
proto.homeflix.RegisterRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RegisterRequest;
  return proto.homeflix.RegisterRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RegisterRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RegisterRequest}
 */
proto.homeflix.RegisterRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUsername(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setEmail(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setPassword(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setFullName(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RegisterRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RegisterRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RegisterRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RegisterRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUsername();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getEmail();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getPassword();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getFullName();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
};


/**
 * optional string username = 1;
 * @return {string}
 */
proto.homeflix.RegisterRequest.prototype.getUsername = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RegisterRequest} returns this
 */
proto.homeflix.RegisterRequest.prototype.setUsername = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string email = 2;
 * @return {string}
 */
proto.homeflix.RegisterRequest.prototype.getEmail = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RegisterRequest} returns this
 */
proto.homeflix.RegisterRequest.prototype.setEmail = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string password = 3;
 * @return {string}
 */
proto.homeflix.RegisterRequest.prototype.getPassword = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RegisterRequest} returns this
 */
proto.homeflix.RegisterRequest.prototype.setPassword = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string full_name = 4;
 * @return {string}
 */
proto.homeflix.RegisterRequest.prototype.getFullName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RegisterRequest} returns this
 */
proto.homeflix.RegisterRequest.prototype.setFullName = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RegisterResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RegisterResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RegisterResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RegisterResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    accessToken: jspb.Message.getFieldWithDefault(msg, 1, ""),
    refreshToken: jspb.Message.getFieldWithDefault(msg, 2, ""),
    user: (f = msg.getUser()) && proto.homeflix.User.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RegisterResponse}
 */
proto.homeflix.RegisterResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RegisterResponse;
  return proto.homeflix.RegisterResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RegisterResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RegisterResponse}
 */
proto.homeflix.RegisterResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setAccessToken(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setRefreshToken(value);
      break;
    case 3:
      var value = new proto.homeflix.User;
      reader.readMessage(value,proto.homeflix.User.deserializeBinaryFromReader);
      msg.setUser(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RegisterResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RegisterResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RegisterResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RegisterResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getAccessToken();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getRefreshToken();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getUser();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.homeflix.User.serializeBinaryToWriter
    );
  }
};


/**
 * optional string access_token = 1;
 * @return {string}
 */
proto.homeflix.RegisterResponse.prototype.getAccessToken = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RegisterResponse} returns this
 */
proto.homeflix.RegisterResponse.prototype.setAccessToken = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string refresh_token = 2;
 * @return {string}
 */
proto.homeflix.RegisterResponse.prototype.getRefreshToken = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RegisterResponse} returns this
 */
proto.homeflix.RegisterResponse.prototype.setRefreshToken = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional User user = 3;
 * @return {?proto.homeflix.User}
 */
proto.homeflix.RegisterResponse.prototype.getUser = function() {
  return /** @type{?proto.homeflix.User} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.User, 3));
};


/**
 * @param {?proto.homeflix.User|undefined} value
 * @return {!proto.homeflix.RegisterResponse} returns this
*/
proto.homeflix.RegisterResponse.prototype.setUser = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.RegisterResponse} returns this
 */
proto.homeflix.RegisterResponse.prototype.clearUser = function() {
  return this.setUser(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.RegisterResponse.prototype.hasUser = function() {
  return jspb.Message.getField(this, 3) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RefreshTokenRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RefreshTokenRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RefreshTokenRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RefreshTokenRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    refreshToken: jspb.Message.getFieldWithDefault(msg, 1, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RefreshTokenRequest}
 */
proto.homeflix.RefreshTokenRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RefreshTokenRequest;
  return proto.homeflix.RefreshTokenRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RefreshTokenRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RefreshTokenRequest}
 */
proto.homeflix.RefreshTokenRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setRefreshToken(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RefreshTokenRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RefreshTokenRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RefreshTokenRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RefreshTokenRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getRefreshToken();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string refresh_token = 1;
 * @return {string}
 */
proto.homeflix.RefreshTokenRequest.prototype.getRefreshToken = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RefreshTokenRequest} returns this
 */
proto.homeflix.RefreshTokenRequest.prototype.setRefreshToken = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RefreshTokenResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RefreshTokenResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RefreshTokenResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RefreshTokenResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    accessToken: jspb.Message.getFieldWithDefault(msg, 1, ""),
    refreshToken: jspb.Message.getFieldWithDefault(msg, 2, ""),
    expiresAt: (f = msg.getExpiresAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RefreshTokenResponse}
 */
proto.homeflix.RefreshTokenResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RefreshTokenResponse;
  return proto.homeflix.RefreshTokenResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RefreshTokenResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RefreshTokenResponse}
 */
proto.homeflix.RefreshTokenResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setAccessToken(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setRefreshToken(value);
      break;
    case 3:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setExpiresAt(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RefreshTokenResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RefreshTokenResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RefreshTokenResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RefreshTokenResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getAccessToken();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getRefreshToken();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getExpiresAt();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
};


/**
 * optional string access_token = 1;
 * @return {string}
 */
proto.homeflix.RefreshTokenResponse.prototype.getAccessToken = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RefreshTokenResponse} returns this
 */
proto.homeflix.RefreshTokenResponse.prototype.setAccessToken = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string refresh_token = 2;
 * @return {string}
 */
proto.homeflix.RefreshTokenResponse.prototype.getRefreshToken = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RefreshTokenResponse} returns this
 */
proto.homeflix.RefreshTokenResponse.prototype.setRefreshToken = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional google.protobuf.Timestamp expires_at = 3;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.RefreshTokenResponse.prototype.getExpiresAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 3));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.RefreshTokenResponse} returns this
*/
proto.homeflix.RefreshTokenResponse.prototype.setExpiresAt = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.RefreshTokenResponse} returns this
 */
proto.homeflix.RefreshTokenResponse.prototype.clearExpiresAt = function() {
  return this.setExpiresAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.RefreshTokenResponse.prototype.hasExpiresAt = function() {
  return jspb.Message.getField(this, 3) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.User.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.User.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.User} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.User.toObject = function(includeInstance, msg) {
  var f, obj = {
    id: jspb.Message.getFieldWithDefault(msg, 1, ""),
    username: jspb.Message.getFieldWithDefault(msg, 2, ""),
    email: jspb.Message.getFieldWithDefault(msg, 3, ""),
    fullName: jspb.Message.getFieldWithDefault(msg, 4, ""),
    role: jspb.Message.getFieldWithDefault(msg, 5, ""),
    createdAt: (f = msg.getCreatedAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    lastLogin: (f = msg.getLastLogin()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    preferences: (f = msg.getPreferences()) && proto.homeflix.UserPreferences.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.User}
 */
proto.homeflix.User.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.User;
  return proto.homeflix.User.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.User} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.User}
 */
proto.homeflix.User.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUsername(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setEmail(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setFullName(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setRole(value);
      break;
    case 6:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setCreatedAt(value);
      break;
    case 7:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setLastLogin(value);
      break;
    case 8:
      var value = new proto.homeflix.UserPreferences;
      reader.readMessage(value,proto.homeflix.UserPreferences.deserializeBinaryFromReader);
      msg.setPreferences(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.User.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.User.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.User} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.User.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getUsername();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getEmail();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getFullName();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getRole();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
  f = message.getCreatedAt();
  if (f != null) {
    writer.writeMessage(
      6,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getLastLogin();
  if (f != null) {
    writer.writeMessage(
      7,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getPreferences();
  if (f != null) {
    writer.writeMessage(
      8,
      f,
      proto.homeflix.UserPreferences.serializeBinaryToWriter
    );
  }
};


/**
 * optional string id = 1;
 * @return {string}
 */
proto.homeflix.User.prototype.getId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.User} returns this
 */
proto.homeflix.User.prototype.setId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string username = 2;
 * @return {string}
 */
proto.homeflix.User.prototype.getUsername = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.User} returns this
 */
proto.homeflix.User.prototype.setUsername = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string email = 3;
 * @return {string}
 */
proto.homeflix.User.prototype.getEmail = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.User} returns this
 */
proto.homeflix.User.prototype.setEmail = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string full_name = 4;
 * @return {string}
 */
proto.homeflix.User.prototype.getFullName = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.User} returns this
 */
proto.homeflix.User.prototype.setFullName = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional string role = 5;
 * @return {string}
 */
proto.homeflix.User.prototype.getRole = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.User} returns this
 */
proto.homeflix.User.prototype.setRole = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};


/**
 * optional google.protobuf.Timestamp created_at = 6;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.User.prototype.getCreatedAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 6));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.User} returns this
*/
proto.homeflix.User.prototype.setCreatedAt = function(value) {
  return jspb.Message.setWrapperField(this, 6, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.User} returns this
 */
proto.homeflix.User.prototype.clearCreatedAt = function() {
  return this.setCreatedAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.User.prototype.hasCreatedAt = function() {
  return jspb.Message.getField(this, 6) != null;
};


/**
 * optional google.protobuf.Timestamp last_login = 7;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.User.prototype.getLastLogin = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 7));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.User} returns this
*/
proto.homeflix.User.prototype.setLastLogin = function(value) {
  return jspb.Message.setWrapperField(this, 7, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.User} returns this
 */
proto.homeflix.User.prototype.clearLastLogin = function() {
  return this.setLastLogin(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.User.prototype.hasLastLogin = function() {
  return jspb.Message.getField(this, 7) != null;
};


/**
 * optional UserPreferences preferences = 8;
 * @return {?proto.homeflix.UserPreferences}
 */
proto.homeflix.User.prototype.getPreferences = function() {
  return /** @type{?proto.homeflix.UserPreferences} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.UserPreferences, 8));
};


/**
 * @param {?proto.homeflix.UserPreferences|undefined} value
 * @return {!proto.homeflix.User} returns this
*/
proto.homeflix.User.prototype.setPreferences = function(value) {
  return jspb.Message.setWrapperField(this, 8, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.User} returns this
 */
proto.homeflix.User.prototype.clearPreferences = function() {
  return this.setPreferences(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.User.prototype.hasPreferences = function() {
  return jspb.Message.getField(this, 8) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetUserPreferencesRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetUserPreferencesRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetUserPreferencesRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetUserPreferencesRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    userId: jspb.Message.getFieldWithDefault(msg, 1, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetUserPreferencesRequest}
 */
proto.homeflix.GetUserPreferencesRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetUserPreferencesRequest;
  return proto.homeflix.GetUserPreferencesRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetUserPreferencesRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetUserPreferencesRequest}
 */
proto.homeflix.GetUserPreferencesRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetUserPreferencesRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetUserPreferencesRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetUserPreferencesRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetUserPreferencesRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string user_id = 1;
 * @return {string}
 */
proto.homeflix.GetUserPreferencesRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetUserPreferencesRequest} returns this
 */
proto.homeflix.GetUserPreferencesRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.UpdateUserPreferencesRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.UpdateUserPreferencesRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.UpdateUserPreferencesRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.UpdateUserPreferencesRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    userId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    preferences: (f = msg.getPreferences()) && proto.homeflix.UserPreferences.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.UpdateUserPreferencesRequest}
 */
proto.homeflix.UpdateUserPreferencesRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.UpdateUserPreferencesRequest;
  return proto.homeflix.UpdateUserPreferencesRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.UpdateUserPreferencesRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.UpdateUserPreferencesRequest}
 */
proto.homeflix.UpdateUserPreferencesRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 2:
      var value = new proto.homeflix.UserPreferences;
      reader.readMessage(value,proto.homeflix.UserPreferences.deserializeBinaryFromReader);
      msg.setPreferences(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.UpdateUserPreferencesRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.UpdateUserPreferencesRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.UpdateUserPreferencesRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.UpdateUserPreferencesRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getPreferences();
  if (f != null) {
    writer.writeMessage(
      2,
      f,
      proto.homeflix.UserPreferences.serializeBinaryToWriter
    );
  }
};


/**
 * optional string user_id = 1;
 * @return {string}
 */
proto.homeflix.UpdateUserPreferencesRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.UpdateUserPreferencesRequest} returns this
 */
proto.homeflix.UpdateUserPreferencesRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional UserPreferences preferences = 2;
 * @return {?proto.homeflix.UserPreferences}
 */
proto.homeflix.UpdateUserPreferencesRequest.prototype.getPreferences = function() {
  return /** @type{?proto.homeflix.UserPreferences} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.UserPreferences, 2));
};


/**
 * @param {?proto.homeflix.UserPreferences|undefined} value
 * @return {!proto.homeflix.UpdateUserPreferencesRequest} returns this
*/
proto.homeflix.UpdateUserPreferencesRequest.prototype.setPreferences = function(value) {
  return jspb.Message.setWrapperField(this, 2, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.UpdateUserPreferencesRequest} returns this
 */
proto.homeflix.UpdateUserPreferencesRequest.prototype.clearPreferences = function() {
  return this.setPreferences(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.UpdateUserPreferencesRequest.prototype.hasPreferences = function() {
  return jspb.Message.getField(this, 2) != null;
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.UserPreferences.repeatedFields_ = [5];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.UserPreferences.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.UserPreferences.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.UserPreferences} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.UserPreferences.toObject = function(includeInstance, msg) {
  var f, obj = {
    preferredLanguage: jspb.Message.getFieldWithDefault(msg, 1, ""),
    preferredQuality: jspb.Message.getFieldWithDefault(msg, 2, ""),
    autoPlayNext: jspb.Message.getBooleanFieldWithDefault(msg, 3, false),
    showAdultContent: jspb.Message.getBooleanFieldWithDefault(msg, 4, false),
    favoriteGenresList: (f = jspb.Message.getRepeatedField(msg, 5)) == null ? undefined : f,
    enableNotifications: jspb.Message.getBooleanFieldWithDefault(msg, 6, false),
    theme: jspb.Message.getFieldWithDefault(msg, 7, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.UserPreferences}
 */
proto.homeflix.UserPreferences.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.UserPreferences;
  return proto.homeflix.UserPreferences.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.UserPreferences} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.UserPreferences}
 */
proto.homeflix.UserPreferences.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setPreferredLanguage(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setPreferredQuality(value);
      break;
    case 3:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setAutoPlayNext(value);
      break;
    case 4:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setShowAdultContent(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.addFavoriteGenres(value);
      break;
    case 6:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setEnableNotifications(value);
      break;
    case 7:
      var value = /** @type {string} */ (reader.readString());
      msg.setTheme(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.UserPreferences.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.UserPreferences.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.UserPreferences} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.UserPreferences.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getPreferredLanguage();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getPreferredQuality();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getAutoPlayNext();
  if (f) {
    writer.writeBool(
      3,
      f
    );
  }
  f = message.getShowAdultContent();
  if (f) {
    writer.writeBool(
      4,
      f
    );
  }
  f = message.getFavoriteGenresList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      5,
      f
    );
  }
  f = message.getEnableNotifications();
  if (f) {
    writer.writeBool(
      6,
      f
    );
  }
  f = message.getTheme();
  if (f.length > 0) {
    writer.writeString(
      7,
      f
    );
  }
};


/**
 * optional string preferred_language = 1;
 * @return {string}
 */
proto.homeflix.UserPreferences.prototype.getPreferredLanguage = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.UserPreferences} returns this
 */
proto.homeflix.UserPreferences.prototype.setPreferredLanguage = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string preferred_quality = 2;
 * @return {string}
 */
proto.homeflix.UserPreferences.prototype.getPreferredQuality = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.UserPreferences} returns this
 */
proto.homeflix.UserPreferences.prototype.setPreferredQuality = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional bool auto_play_next = 3;
 * @return {boolean}
 */
proto.homeflix.UserPreferences.prototype.getAutoPlayNext = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 3, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.UserPreferences} returns this
 */
proto.homeflix.UserPreferences.prototype.setAutoPlayNext = function(value) {
  return jspb.Message.setProto3BooleanField(this, 3, value);
};


/**
 * optional bool show_adult_content = 4;
 * @return {boolean}
 */
proto.homeflix.UserPreferences.prototype.getShowAdultContent = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 4, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.UserPreferences} returns this
 */
proto.homeflix.UserPreferences.prototype.setShowAdultContent = function(value) {
  return jspb.Message.setProto3BooleanField(this, 4, value);
};


/**
 * repeated string favorite_genres = 5;
 * @return {!Array<string>}
 */
proto.homeflix.UserPreferences.prototype.getFavoriteGenresList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 5));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.UserPreferences} returns this
 */
proto.homeflix.UserPreferences.prototype.setFavoriteGenresList = function(value) {
  return jspb.Message.setField(this, 5, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.UserPreferences} returns this
 */
proto.homeflix.UserPreferences.prototype.addFavoriteGenres = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 5, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.UserPreferences} returns this
 */
proto.homeflix.UserPreferences.prototype.clearFavoriteGenresList = function() {
  return this.setFavoriteGenresList([]);
};


/**
 * optional bool enable_notifications = 6;
 * @return {boolean}
 */
proto.homeflix.UserPreferences.prototype.getEnableNotifications = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 6, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.UserPreferences} returns this
 */
proto.homeflix.UserPreferences.prototype.setEnableNotifications = function(value) {
  return jspb.Message.setProto3BooleanField(this, 6, value);
};


/**
 * optional string theme = 7;
 * @return {string}
 */
proto.homeflix.UserPreferences.prototype.getTheme = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 7, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.UserPreferences} returns this
 */
proto.homeflix.UserPreferences.prototype.setTheme = function(value) {
  return jspb.Message.setProto3StringField(this, 7, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.UpdateWatchProgressRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.UpdateWatchProgressRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.UpdateWatchProgressRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    userId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 3, ""),
    progressSeconds: jspb.Message.getFieldWithDefault(msg, 4, 0),
    totalSeconds: jspb.Message.getFieldWithDefault(msg, 5, 0),
    completed: jspb.Message.getBooleanFieldWithDefault(msg, 6, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.UpdateWatchProgressRequest}
 */
proto.homeflix.UpdateWatchProgressRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.UpdateWatchProgressRequest;
  return proto.homeflix.UpdateWatchProgressRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.UpdateWatchProgressRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.UpdateWatchProgressRequest}
 */
proto.homeflix.UpdateWatchProgressRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setProgressSeconds(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalSeconds(value);
      break;
    case 6:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setCompleted(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.UpdateWatchProgressRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.UpdateWatchProgressRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.UpdateWatchProgressRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getProgressSeconds();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
  f = message.getTotalSeconds();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
  f = message.getCompleted();
  if (f) {
    writer.writeBool(
      6,
      f
    );
  }
};


/**
 * optional string user_id = 1;
 * @return {string}
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.UpdateWatchProgressRequest} returns this
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_id = 2;
 * @return {string}
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.UpdateWatchProgressRequest} returns this
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string media_type = 3;
 * @return {string}
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.UpdateWatchProgressRequest} returns this
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional int32 progress_seconds = 4;
 * @return {number}
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.getProgressSeconds = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.UpdateWatchProgressRequest} returns this
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.setProgressSeconds = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional int32 total_seconds = 5;
 * @return {number}
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.getTotalSeconds = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.UpdateWatchProgressRequest} returns this
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.setTotalSeconds = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


/**
 * optional bool completed = 6;
 * @return {boolean}
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.getCompleted = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 6, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.UpdateWatchProgressRequest} returns this
 */
proto.homeflix.UpdateWatchProgressRequest.prototype.setCompleted = function(value) {
  return jspb.Message.setProto3BooleanField(this, 6, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.WatchProgress.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.WatchProgress.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.WatchProgress} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.WatchProgress.toObject = function(includeInstance, msg) {
  var f, obj = {
    id: jspb.Message.getFieldWithDefault(msg, 1, ""),
    userId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    mediaId: jspb.Message.getFieldWithDefault(msg, 3, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 4, ""),
    progressSeconds: jspb.Message.getFieldWithDefault(msg, 5, 0),
    totalSeconds: jspb.Message.getFieldWithDefault(msg, 6, 0),
    progressPercent: jspb.Message.getFloatingPointFieldWithDefault(msg, 7, 0.0),
    completed: jspb.Message.getBooleanFieldWithDefault(msg, 8, false),
    lastWatched: (f = msg.getLastWatched()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.WatchProgress}
 */
proto.homeflix.WatchProgress.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.WatchProgress;
  return proto.homeflix.WatchProgress.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.WatchProgress} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.WatchProgress}
 */
proto.homeflix.WatchProgress.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setProgressSeconds(value);
      break;
    case 6:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalSeconds(value);
      break;
    case 7:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setProgressPercent(value);
      break;
    case 8:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setCompleted(value);
      break;
    case 9:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setLastWatched(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.WatchProgress.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.WatchProgress.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.WatchProgress} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.WatchProgress.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getProgressSeconds();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
  f = message.getTotalSeconds();
  if (f !== 0) {
    writer.writeInt32(
      6,
      f
    );
  }
  f = message.getProgressPercent();
  if (f !== 0.0) {
    writer.writeDouble(
      7,
      f
    );
  }
  f = message.getCompleted();
  if (f) {
    writer.writeBool(
      8,
      f
    );
  }
  f = message.getLastWatched();
  if (f != null) {
    writer.writeMessage(
      9,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
};


/**
 * optional string id = 1;
 * @return {string}
 */
proto.homeflix.WatchProgress.prototype.getId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.WatchProgress} returns this
 */
proto.homeflix.WatchProgress.prototype.setId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string user_id = 2;
 * @return {string}
 */
proto.homeflix.WatchProgress.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.WatchProgress} returns this
 */
proto.homeflix.WatchProgress.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string media_id = 3;
 * @return {string}
 */
proto.homeflix.WatchProgress.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.WatchProgress} returns this
 */
proto.homeflix.WatchProgress.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string media_type = 4;
 * @return {string}
 */
proto.homeflix.WatchProgress.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.WatchProgress} returns this
 */
proto.homeflix.WatchProgress.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional int32 progress_seconds = 5;
 * @return {number}
 */
proto.homeflix.WatchProgress.prototype.getProgressSeconds = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.WatchProgress} returns this
 */
proto.homeflix.WatchProgress.prototype.setProgressSeconds = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


/**
 * optional int32 total_seconds = 6;
 * @return {number}
 */
proto.homeflix.WatchProgress.prototype.getTotalSeconds = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 6, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.WatchProgress} returns this
 */
proto.homeflix.WatchProgress.prototype.setTotalSeconds = function(value) {
  return jspb.Message.setProto3IntField(this, 6, value);
};


/**
 * optional double progress_percent = 7;
 * @return {number}
 */
proto.homeflix.WatchProgress.prototype.getProgressPercent = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 7, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.WatchProgress} returns this
 */
proto.homeflix.WatchProgress.prototype.setProgressPercent = function(value) {
  return jspb.Message.setProto3FloatField(this, 7, value);
};


/**
 * optional bool completed = 8;
 * @return {boolean}
 */
proto.homeflix.WatchProgress.prototype.getCompleted = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 8, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.WatchProgress} returns this
 */
proto.homeflix.WatchProgress.prototype.setCompleted = function(value) {
  return jspb.Message.setProto3BooleanField(this, 8, value);
};


/**
 * optional google.protobuf.Timestamp last_watched = 9;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.WatchProgress.prototype.getLastWatched = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 9));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.WatchProgress} returns this
*/
proto.homeflix.WatchProgress.prototype.setLastWatched = function(value) {
  return jspb.Message.setWrapperField(this, 9, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.WatchProgress} returns this
 */
proto.homeflix.WatchProgress.prototype.clearLastWatched = function() {
  return this.setLastWatched(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.WatchProgress.prototype.hasLastWatched = function() {
  return jspb.Message.getField(this, 9) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetWatchHistoryRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetWatchHistoryRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetWatchHistoryRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetWatchHistoryRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    userId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    limit: jspb.Message.getFieldWithDefault(msg, 2, 0),
    offset: jspb.Message.getFieldWithDefault(msg, 3, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetWatchHistoryRequest}
 */
proto.homeflix.GetWatchHistoryRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetWatchHistoryRequest;
  return proto.homeflix.GetWatchHistoryRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetWatchHistoryRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetWatchHistoryRequest}
 */
proto.homeflix.GetWatchHistoryRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setOffset(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetWatchHistoryRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetWatchHistoryRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetWatchHistoryRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetWatchHistoryRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getOffset();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
};


/**
 * optional string user_id = 1;
 * @return {string}
 */
proto.homeflix.GetWatchHistoryRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetWatchHistoryRequest} returns this
 */
proto.homeflix.GetWatchHistoryRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 limit = 2;
 * @return {number}
 */
proto.homeflix.GetWatchHistoryRequest.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetWatchHistoryRequest} returns this
 */
proto.homeflix.GetWatchHistoryRequest.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional int32 offset = 3;
 * @return {number}
 */
proto.homeflix.GetWatchHistoryRequest.prototype.getOffset = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetWatchHistoryRequest} returns this
 */
proto.homeflix.GetWatchHistoryRequest.prototype.setOffset = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.GetWatchHistoryResponse.repeatedFields_ = [1];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetWatchHistoryResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetWatchHistoryResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetWatchHistoryResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetWatchHistoryResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    itemsList: jspb.Message.toObjectList(msg.getItemsList(),
    proto.homeflix.WatchHistoryItem.toObject, includeInstance),
    totalCount: jspb.Message.getFieldWithDefault(msg, 2, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetWatchHistoryResponse}
 */
proto.homeflix.GetWatchHistoryResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetWatchHistoryResponse;
  return proto.homeflix.GetWatchHistoryResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetWatchHistoryResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetWatchHistoryResponse}
 */
proto.homeflix.GetWatchHistoryResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.homeflix.WatchHistoryItem;
      reader.readMessage(value,proto.homeflix.WatchHistoryItem.deserializeBinaryFromReader);
      msg.addItems(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalCount(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetWatchHistoryResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetWatchHistoryResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetWatchHistoryResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetWatchHistoryResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getItemsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.homeflix.WatchHistoryItem.serializeBinaryToWriter
    );
  }
  f = message.getTotalCount();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
};


/**
 * repeated WatchHistoryItem items = 1;
 * @return {!Array<!proto.homeflix.WatchHistoryItem>}
 */
proto.homeflix.GetWatchHistoryResponse.prototype.getItemsList = function() {
  return /** @type{!Array<!proto.homeflix.WatchHistoryItem>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.WatchHistoryItem, 1));
};


/**
 * @param {!Array<!proto.homeflix.WatchHistoryItem>} value
 * @return {!proto.homeflix.GetWatchHistoryResponse} returns this
*/
proto.homeflix.GetWatchHistoryResponse.prototype.setItemsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.homeflix.WatchHistoryItem=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.WatchHistoryItem}
 */
proto.homeflix.GetWatchHistoryResponse.prototype.addItems = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.homeflix.WatchHistoryItem, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.GetWatchHistoryResponse} returns this
 */
proto.homeflix.GetWatchHistoryResponse.prototype.clearItemsList = function() {
  return this.setItemsList([]);
};


/**
 * optional int32 total_count = 2;
 * @return {number}
 */
proto.homeflix.GetWatchHistoryResponse.prototype.getTotalCount = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetWatchHistoryResponse} returns this
 */
proto.homeflix.GetWatchHistoryResponse.prototype.setTotalCount = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.WatchHistoryItem.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.WatchHistoryItem.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.WatchHistoryItem} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.WatchHistoryItem.toObject = function(includeInstance, msg) {
  var f, obj = {
    progress: (f = msg.getProgress()) && proto.homeflix.WatchProgress.toObject(includeInstance, f),
    movie: (f = msg.getMovie()) && proto.homeflix.Movie.toObject(includeInstance, f),
    episode: (f = msg.getEpisode()) && proto.homeflix.Episode.toObject(includeInstance, f),
    series: (f = msg.getSeries()) && proto.homeflix.Series.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.WatchHistoryItem}
 */
proto.homeflix.WatchHistoryItem.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.WatchHistoryItem;
  return proto.homeflix.WatchHistoryItem.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.WatchHistoryItem} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.WatchHistoryItem}
 */
proto.homeflix.WatchHistoryItem.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.homeflix.WatchProgress;
      reader.readMessage(value,proto.homeflix.WatchProgress.deserializeBinaryFromReader);
      msg.setProgress(value);
      break;
    case 2:
      var value = new proto.homeflix.Movie;
      reader.readMessage(value,proto.homeflix.Movie.deserializeBinaryFromReader);
      msg.setMovie(value);
      break;
    case 3:
      var value = new proto.homeflix.Episode;
      reader.readMessage(value,proto.homeflix.Episode.deserializeBinaryFromReader);
      msg.setEpisode(value);
      break;
    case 4:
      var value = new proto.homeflix.Series;
      reader.readMessage(value,proto.homeflix.Series.deserializeBinaryFromReader);
      msg.setSeries(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.WatchHistoryItem.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.WatchHistoryItem.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.WatchHistoryItem} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.WatchHistoryItem.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getProgress();
  if (f != null) {
    writer.writeMessage(
      1,
      f,
      proto.homeflix.WatchProgress.serializeBinaryToWriter
    );
  }
  f = message.getMovie();
  if (f != null) {
    writer.writeMessage(
      2,
      f,
      proto.homeflix.Movie.serializeBinaryToWriter
    );
  }
  f = message.getEpisode();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.homeflix.Episode.serializeBinaryToWriter
    );
  }
  f = message.getSeries();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      proto.homeflix.Series.serializeBinaryToWriter
    );
  }
};


/**
 * optional WatchProgress progress = 1;
 * @return {?proto.homeflix.WatchProgress}
 */
proto.homeflix.WatchHistoryItem.prototype.getProgress = function() {
  return /** @type{?proto.homeflix.WatchProgress} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.WatchProgress, 1));
};


/**
 * @param {?proto.homeflix.WatchProgress|undefined} value
 * @return {!proto.homeflix.WatchHistoryItem} returns this
*/
proto.homeflix.WatchHistoryItem.prototype.setProgress = function(value) {
  return jspb.Message.setWrapperField(this, 1, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.WatchHistoryItem} returns this
 */
proto.homeflix.WatchHistoryItem.prototype.clearProgress = function() {
  return this.setProgress(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.WatchHistoryItem.prototype.hasProgress = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * optional Movie movie = 2;
 * @return {?proto.homeflix.Movie}
 */
proto.homeflix.WatchHistoryItem.prototype.getMovie = function() {
  return /** @type{?proto.homeflix.Movie} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.Movie, 2));
};


/**
 * @param {?proto.homeflix.Movie|undefined} value
 * @return {!proto.homeflix.WatchHistoryItem} returns this
*/
proto.homeflix.WatchHistoryItem.prototype.setMovie = function(value) {
  return jspb.Message.setWrapperField(this, 2, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.WatchHistoryItem} returns this
 */
proto.homeflix.WatchHistoryItem.prototype.clearMovie = function() {
  return this.setMovie(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.WatchHistoryItem.prototype.hasMovie = function() {
  return jspb.Message.getField(this, 2) != null;
};


/**
 * optional Episode episode = 3;
 * @return {?proto.homeflix.Episode}
 */
proto.homeflix.WatchHistoryItem.prototype.getEpisode = function() {
  return /** @type{?proto.homeflix.Episode} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.Episode, 3));
};


/**
 * @param {?proto.homeflix.Episode|undefined} value
 * @return {!proto.homeflix.WatchHistoryItem} returns this
*/
proto.homeflix.WatchHistoryItem.prototype.setEpisode = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.WatchHistoryItem} returns this
 */
proto.homeflix.WatchHistoryItem.prototype.clearEpisode = function() {
  return this.setEpisode(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.WatchHistoryItem.prototype.hasEpisode = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional Series series = 4;
 * @return {?proto.homeflix.Series}
 */
proto.homeflix.WatchHistoryItem.prototype.getSeries = function() {
  return /** @type{?proto.homeflix.Series} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.Series, 4));
};


/**
 * @param {?proto.homeflix.Series|undefined} value
 * @return {!proto.homeflix.WatchHistoryItem} returns this
*/
proto.homeflix.WatchHistoryItem.prototype.setSeries = function(value) {
  return jspb.Message.setWrapperField(this, 4, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.WatchHistoryItem} returns this
 */
proto.homeflix.WatchHistoryItem.prototype.clearSeries = function() {
  return this.setSeries(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.WatchHistoryItem.prototype.hasSeries = function() {
  return jspb.Message.getField(this, 4) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RecommendationRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RecommendationRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RecommendationRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RecommendationRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    userId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    limit: jspb.Message.getFieldWithDefault(msg, 2, 0),
    recommendationType: jspb.Message.getFieldWithDefault(msg, 3, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RecommendationRequest}
 */
proto.homeflix.RecommendationRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RecommendationRequest;
  return proto.homeflix.RecommendationRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RecommendationRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RecommendationRequest}
 */
proto.homeflix.RecommendationRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setRecommendationType(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RecommendationRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RecommendationRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RecommendationRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RecommendationRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getRecommendationType();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
};


/**
 * optional string user_id = 1;
 * @return {string}
 */
proto.homeflix.RecommendationRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RecommendationRequest} returns this
 */
proto.homeflix.RecommendationRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 limit = 2;
 * @return {number}
 */
proto.homeflix.RecommendationRequest.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.RecommendationRequest} returns this
 */
proto.homeflix.RecommendationRequest.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional string recommendation_type = 3;
 * @return {string}
 */
proto.homeflix.RecommendationRequest.prototype.getRecommendationType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RecommendationRequest} returns this
 */
proto.homeflix.RecommendationRequest.prototype.setRecommendationType = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.RecommendationResponse.repeatedFields_ = [1];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RecommendationResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RecommendationResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RecommendationResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RecommendationResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    recommendationsList: jspb.Message.toObjectList(msg.getRecommendationsList(),
    proto.homeflix.RecommendationItem.toObject, includeInstance),
    recommendationType: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RecommendationResponse}
 */
proto.homeflix.RecommendationResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RecommendationResponse;
  return proto.homeflix.RecommendationResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RecommendationResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RecommendationResponse}
 */
proto.homeflix.RecommendationResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.homeflix.RecommendationItem;
      reader.readMessage(value,proto.homeflix.RecommendationItem.deserializeBinaryFromReader);
      msg.addRecommendations(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setRecommendationType(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RecommendationResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RecommendationResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RecommendationResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RecommendationResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getRecommendationsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.homeflix.RecommendationItem.serializeBinaryToWriter
    );
  }
  f = message.getRecommendationType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * repeated RecommendationItem recommendations = 1;
 * @return {!Array<!proto.homeflix.RecommendationItem>}
 */
proto.homeflix.RecommendationResponse.prototype.getRecommendationsList = function() {
  return /** @type{!Array<!proto.homeflix.RecommendationItem>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.RecommendationItem, 1));
};


/**
 * @param {!Array<!proto.homeflix.RecommendationItem>} value
 * @return {!proto.homeflix.RecommendationResponse} returns this
*/
proto.homeflix.RecommendationResponse.prototype.setRecommendationsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.homeflix.RecommendationItem=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.RecommendationItem}
 */
proto.homeflix.RecommendationResponse.prototype.addRecommendations = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.homeflix.RecommendationItem, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.RecommendationResponse} returns this
 */
proto.homeflix.RecommendationResponse.prototype.clearRecommendationsList = function() {
  return this.setRecommendationsList([]);
};


/**
 * optional string recommendation_type = 2;
 * @return {string}
 */
proto.homeflix.RecommendationResponse.prototype.getRecommendationType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RecommendationResponse} returns this
 */
proto.homeflix.RecommendationResponse.prototype.setRecommendationType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RecommendationStreamRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RecommendationStreamRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RecommendationStreamRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RecommendationStreamRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    userId: jspb.Message.getFieldWithDefault(msg, 1, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RecommendationStreamRequest}
 */
proto.homeflix.RecommendationStreamRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RecommendationStreamRequest;
  return proto.homeflix.RecommendationStreamRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RecommendationStreamRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RecommendationStreamRequest}
 */
proto.homeflix.RecommendationStreamRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RecommendationStreamRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RecommendationStreamRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RecommendationStreamRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RecommendationStreamRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string user_id = 1;
 * @return {string}
 */
proto.homeflix.RecommendationStreamRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RecommendationStreamRequest} returns this
 */
proto.homeflix.RecommendationStreamRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.RecommendationUpdate.repeatedFields_ = [1];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RecommendationUpdate.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RecommendationUpdate.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RecommendationUpdate} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RecommendationUpdate.toObject = function(includeInstance, msg) {
  var f, obj = {
    recommendationsList: jspb.Message.toObjectList(msg.getRecommendationsList(),
    proto.homeflix.RecommendationItem.toObject, includeInstance),
    updateReason: jspb.Message.getFieldWithDefault(msg, 2, ""),
    timestamp: (f = msg.getTimestamp()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RecommendationUpdate}
 */
proto.homeflix.RecommendationUpdate.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RecommendationUpdate;
  return proto.homeflix.RecommendationUpdate.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RecommendationUpdate} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RecommendationUpdate}
 */
proto.homeflix.RecommendationUpdate.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.homeflix.RecommendationItem;
      reader.readMessage(value,proto.homeflix.RecommendationItem.deserializeBinaryFromReader);
      msg.addRecommendations(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUpdateReason(value);
      break;
    case 3:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setTimestamp(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RecommendationUpdate.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RecommendationUpdate.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RecommendationUpdate} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RecommendationUpdate.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getRecommendationsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.homeflix.RecommendationItem.serializeBinaryToWriter
    );
  }
  f = message.getUpdateReason();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getTimestamp();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
};


/**
 * repeated RecommendationItem recommendations = 1;
 * @return {!Array<!proto.homeflix.RecommendationItem>}
 */
proto.homeflix.RecommendationUpdate.prototype.getRecommendationsList = function() {
  return /** @type{!Array<!proto.homeflix.RecommendationItem>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.RecommendationItem, 1));
};


/**
 * @param {!Array<!proto.homeflix.RecommendationItem>} value
 * @return {!proto.homeflix.RecommendationUpdate} returns this
*/
proto.homeflix.RecommendationUpdate.prototype.setRecommendationsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.homeflix.RecommendationItem=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.RecommendationItem}
 */
proto.homeflix.RecommendationUpdate.prototype.addRecommendations = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.homeflix.RecommendationItem, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.RecommendationUpdate} returns this
 */
proto.homeflix.RecommendationUpdate.prototype.clearRecommendationsList = function() {
  return this.setRecommendationsList([]);
};


/**
 * optional string update_reason = 2;
 * @return {string}
 */
proto.homeflix.RecommendationUpdate.prototype.getUpdateReason = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RecommendationUpdate} returns this
 */
proto.homeflix.RecommendationUpdate.prototype.setUpdateReason = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional google.protobuf.Timestamp timestamp = 3;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.RecommendationUpdate.prototype.getTimestamp = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 3));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.RecommendationUpdate} returns this
*/
proto.homeflix.RecommendationUpdate.prototype.setTimestamp = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.RecommendationUpdate} returns this
 */
proto.homeflix.RecommendationUpdate.prototype.clearTimestamp = function() {
  return this.setTimestamp(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.RecommendationUpdate.prototype.hasTimestamp = function() {
  return jspb.Message.getField(this, 3) != null;
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.RecommendationItem.repeatedFields_ = [5];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RecommendationItem.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RecommendationItem.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RecommendationItem} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RecommendationItem.toObject = function(includeInstance, msg) {
  var f, obj = {
    movie: (f = msg.getMovie()) && proto.homeflix.Movie.toObject(includeInstance, f),
    series: (f = msg.getSeries()) && proto.homeflix.Series.toObject(includeInstance, f),
    score: jspb.Message.getFloatingPointFieldWithDefault(msg, 3, 0.0),
    reason: jspb.Message.getFieldWithDefault(msg, 4, ""),
    tagsList: (f = jspb.Message.getRepeatedField(msg, 5)) == null ? undefined : f
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RecommendationItem}
 */
proto.homeflix.RecommendationItem.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RecommendationItem;
  return proto.homeflix.RecommendationItem.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RecommendationItem} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RecommendationItem}
 */
proto.homeflix.RecommendationItem.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.homeflix.Movie;
      reader.readMessage(value,proto.homeflix.Movie.deserializeBinaryFromReader);
      msg.setMovie(value);
      break;
    case 2:
      var value = new proto.homeflix.Series;
      reader.readMessage(value,proto.homeflix.Series.deserializeBinaryFromReader);
      msg.setSeries(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setScore(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setReason(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.addTags(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RecommendationItem.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RecommendationItem.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RecommendationItem} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RecommendationItem.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMovie();
  if (f != null) {
    writer.writeMessage(
      1,
      f,
      proto.homeflix.Movie.serializeBinaryToWriter
    );
  }
  f = message.getSeries();
  if (f != null) {
    writer.writeMessage(
      2,
      f,
      proto.homeflix.Series.serializeBinaryToWriter
    );
  }
  f = message.getScore();
  if (f !== 0.0) {
    writer.writeDouble(
      3,
      f
    );
  }
  f = message.getReason();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getTagsList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      5,
      f
    );
  }
};


/**
 * optional Movie movie = 1;
 * @return {?proto.homeflix.Movie}
 */
proto.homeflix.RecommendationItem.prototype.getMovie = function() {
  return /** @type{?proto.homeflix.Movie} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.Movie, 1));
};


/**
 * @param {?proto.homeflix.Movie|undefined} value
 * @return {!proto.homeflix.RecommendationItem} returns this
*/
proto.homeflix.RecommendationItem.prototype.setMovie = function(value) {
  return jspb.Message.setWrapperField(this, 1, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.RecommendationItem} returns this
 */
proto.homeflix.RecommendationItem.prototype.clearMovie = function() {
  return this.setMovie(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.RecommendationItem.prototype.hasMovie = function() {
  return jspb.Message.getField(this, 1) != null;
};


/**
 * optional Series series = 2;
 * @return {?proto.homeflix.Series}
 */
proto.homeflix.RecommendationItem.prototype.getSeries = function() {
  return /** @type{?proto.homeflix.Series} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.Series, 2));
};


/**
 * @param {?proto.homeflix.Series|undefined} value
 * @return {!proto.homeflix.RecommendationItem} returns this
*/
proto.homeflix.RecommendationItem.prototype.setSeries = function(value) {
  return jspb.Message.setWrapperField(this, 2, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.RecommendationItem} returns this
 */
proto.homeflix.RecommendationItem.prototype.clearSeries = function() {
  return this.setSeries(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.RecommendationItem.prototype.hasSeries = function() {
  return jspb.Message.getField(this, 2) != null;
};


/**
 * optional double score = 3;
 * @return {number}
 */
proto.homeflix.RecommendationItem.prototype.getScore = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 3, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.RecommendationItem} returns this
 */
proto.homeflix.RecommendationItem.prototype.setScore = function(value) {
  return jspb.Message.setProto3FloatField(this, 3, value);
};


/**
 * optional string reason = 4;
 * @return {string}
 */
proto.homeflix.RecommendationItem.prototype.getReason = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RecommendationItem} returns this
 */
proto.homeflix.RecommendationItem.prototype.setReason = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * repeated string tags = 5;
 * @return {!Array<string>}
 */
proto.homeflix.RecommendationItem.prototype.getTagsList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 5));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.RecommendationItem} returns this
 */
proto.homeflix.RecommendationItem.prototype.setTagsList = function(value) {
  return jspb.Message.setField(this, 5, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.RecommendationItem} returns this
 */
proto.homeflix.RecommendationItem.prototype.addTags = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 5, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.RecommendationItem} returns this
 */
proto.homeflix.RecommendationItem.prototype.clearTagsList = function() {
  return this.setTagsList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RateMediaRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RateMediaRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RateMediaRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RateMediaRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    userId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 3, ""),
    rating: jspb.Message.getFloatingPointFieldWithDefault(msg, 4, 0.0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RateMediaRequest}
 */
proto.homeflix.RateMediaRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RateMediaRequest;
  return proto.homeflix.RateMediaRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RateMediaRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RateMediaRequest}
 */
proto.homeflix.RateMediaRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setRating(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RateMediaRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RateMediaRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RateMediaRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RateMediaRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getRating();
  if (f !== 0.0) {
    writer.writeDouble(
      4,
      f
    );
  }
};


/**
 * optional string user_id = 1;
 * @return {string}
 */
proto.homeflix.RateMediaRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RateMediaRequest} returns this
 */
proto.homeflix.RateMediaRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_id = 2;
 * @return {string}
 */
proto.homeflix.RateMediaRequest.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RateMediaRequest} returns this
 */
proto.homeflix.RateMediaRequest.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string media_type = 3;
 * @return {string}
 */
proto.homeflix.RateMediaRequest.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.RateMediaRequest} returns this
 */
proto.homeflix.RateMediaRequest.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional double rating = 4;
 * @return {number}
 */
proto.homeflix.RateMediaRequest.prototype.getRating = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 4, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.RateMediaRequest} returns this
 */
proto.homeflix.RateMediaRequest.prototype.setRating = function(value) {
  return jspb.Message.setProto3FloatField(this, 4, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.RateMediaResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.RateMediaResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.RateMediaResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RateMediaResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    success: jspb.Message.getBooleanFieldWithDefault(msg, 1, false),
    newAverageRating: jspb.Message.getFloatingPointFieldWithDefault(msg, 2, 0.0),
    totalRatings: jspb.Message.getFieldWithDefault(msg, 3, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.RateMediaResponse}
 */
proto.homeflix.RateMediaResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.RateMediaResponse;
  return proto.homeflix.RateMediaResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.RateMediaResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.RateMediaResponse}
 */
proto.homeflix.RateMediaResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setSuccess(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setNewAverageRating(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalRatings(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.RateMediaResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.RateMediaResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.RateMediaResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.RateMediaResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSuccess();
  if (f) {
    writer.writeBool(
      1,
      f
    );
  }
  f = message.getNewAverageRating();
  if (f !== 0.0) {
    writer.writeDouble(
      2,
      f
    );
  }
  f = message.getTotalRatings();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
};


/**
 * optional bool success = 1;
 * @return {boolean}
 */
proto.homeflix.RateMediaResponse.prototype.getSuccess = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 1, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.RateMediaResponse} returns this
 */
proto.homeflix.RateMediaResponse.prototype.setSuccess = function(value) {
  return jspb.Message.setProto3BooleanField(this, 1, value);
};


/**
 * optional double new_average_rating = 2;
 * @return {number}
 */
proto.homeflix.RateMediaResponse.prototype.getNewAverageRating = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 2, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.RateMediaResponse} returns this
 */
proto.homeflix.RateMediaResponse.prototype.setNewAverageRating = function(value) {
  return jspb.Message.setProto3FloatField(this, 2, value);
};


/**
 * optional int32 total_ratings = 3;
 * @return {number}
 */
proto.homeflix.RateMediaResponse.prototype.getTotalRatings = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.RateMediaResponse} returns this
 */
proto.homeflix.RateMediaResponse.prototype.setTotalRatings = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.SimilarMediaRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.SimilarMediaRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.SimilarMediaRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SimilarMediaRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    mediaId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 2, ""),
    limit: jspb.Message.getFieldWithDefault(msg, 3, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.SimilarMediaRequest}
 */
proto.homeflix.SimilarMediaRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.SimilarMediaRequest;
  return proto.homeflix.SimilarMediaRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.SimilarMediaRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.SimilarMediaRequest}
 */
proto.homeflix.SimilarMediaRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.SimilarMediaRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.SimilarMediaRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.SimilarMediaRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SimilarMediaRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
};


/**
 * optional string media_id = 1;
 * @return {string}
 */
proto.homeflix.SimilarMediaRequest.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.SimilarMediaRequest} returns this
 */
proto.homeflix.SimilarMediaRequest.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_type = 2;
 * @return {string}
 */
proto.homeflix.SimilarMediaRequest.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.SimilarMediaRequest} returns this
 */
proto.homeflix.SimilarMediaRequest.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional int32 limit = 3;
 * @return {number}
 */
proto.homeflix.SimilarMediaRequest.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.SimilarMediaRequest} returns this
 */
proto.homeflix.SimilarMediaRequest.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PlaybackCommand.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PlaybackCommand.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PlaybackCommand} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PlaybackCommand.toObject = function(includeInstance, msg) {
  var f, obj = {
    sessionId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    userId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    mediaId: jspb.Message.getFieldWithDefault(msg, 3, ""),
    command: jspb.Message.getFieldWithDefault(msg, 4, ""),
    parametersMap: (f = msg.getParametersMap()) ? f.toObject(includeInstance, undefined) : [],
    timestamp: (f = msg.getTimestamp()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PlaybackCommand}
 */
proto.homeflix.PlaybackCommand.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PlaybackCommand;
  return proto.homeflix.PlaybackCommand.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PlaybackCommand} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PlaybackCommand}
 */
proto.homeflix.PlaybackCommand.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setSessionId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setCommand(value);
      break;
    case 5:
      var value = msg.getParametersMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readString, null, "", "");
         });
      break;
    case 6:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setTimestamp(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PlaybackCommand.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PlaybackCommand.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PlaybackCommand} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PlaybackCommand.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSessionId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getCommand();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getParametersMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(5, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeString);
  }
  f = message.getTimestamp();
  if (f != null) {
    writer.writeMessage(
      6,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
};


/**
 * optional string session_id = 1;
 * @return {string}
 */
proto.homeflix.PlaybackCommand.prototype.getSessionId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackCommand} returns this
 */
proto.homeflix.PlaybackCommand.prototype.setSessionId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string user_id = 2;
 * @return {string}
 */
proto.homeflix.PlaybackCommand.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackCommand} returns this
 */
proto.homeflix.PlaybackCommand.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string media_id = 3;
 * @return {string}
 */
proto.homeflix.PlaybackCommand.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackCommand} returns this
 */
proto.homeflix.PlaybackCommand.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string command = 4;
 * @return {string}
 */
proto.homeflix.PlaybackCommand.prototype.getCommand = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackCommand} returns this
 */
proto.homeflix.PlaybackCommand.prototype.setCommand = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * map<string, string> parameters = 5;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,string>}
 */
proto.homeflix.PlaybackCommand.prototype.getParametersMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,string>} */ (
      jspb.Message.getMapField(this, 5, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.homeflix.PlaybackCommand} returns this
 */
proto.homeflix.PlaybackCommand.prototype.clearParametersMap = function() {
  this.getParametersMap().clear();
  return this;};


/**
 * optional google.protobuf.Timestamp timestamp = 6;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.PlaybackCommand.prototype.getTimestamp = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 6));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.PlaybackCommand} returns this
*/
proto.homeflix.PlaybackCommand.prototype.setTimestamp = function(value) {
  return jspb.Message.setWrapperField(this, 6, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.PlaybackCommand} returns this
 */
proto.homeflix.PlaybackCommand.prototype.clearTimestamp = function() {
  return this.setTimestamp(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.PlaybackCommand.prototype.hasTimestamp = function() {
  return jspb.Message.getField(this, 6) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PlaybackStatus.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PlaybackStatus.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PlaybackStatus} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PlaybackStatus.toObject = function(includeInstance, msg) {
  var f, obj = {
    sessionId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    state: jspb.Message.getFieldWithDefault(msg, 3, ""),
    currentTime: jspb.Message.getFieldWithDefault(msg, 4, 0),
    duration: jspb.Message.getFieldWithDefault(msg, 5, 0),
    volume: jspb.Message.getFloatingPointFieldWithDefault(msg, 6, 0.0),
    muted: jspb.Message.getBooleanFieldWithDefault(msg, 7, false),
    quality: jspb.Message.getFieldWithDefault(msg, 8, ""),
    timestamp: (f = msg.getTimestamp()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PlaybackStatus}
 */
proto.homeflix.PlaybackStatus.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PlaybackStatus;
  return proto.homeflix.PlaybackStatus.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PlaybackStatus} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PlaybackStatus}
 */
proto.homeflix.PlaybackStatus.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setSessionId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setState(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setCurrentTime(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setDuration(value);
      break;
    case 6:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setVolume(value);
      break;
    case 7:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setMuted(value);
      break;
    case 8:
      var value = /** @type {string} */ (reader.readString());
      msg.setQuality(value);
      break;
    case 9:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setTimestamp(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PlaybackStatus.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PlaybackStatus.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PlaybackStatus} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PlaybackStatus.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSessionId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getState();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getCurrentTime();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
  f = message.getDuration();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
  f = message.getVolume();
  if (f !== 0.0) {
    writer.writeDouble(
      6,
      f
    );
  }
  f = message.getMuted();
  if (f) {
    writer.writeBool(
      7,
      f
    );
  }
  f = message.getQuality();
  if (f.length > 0) {
    writer.writeString(
      8,
      f
    );
  }
  f = message.getTimestamp();
  if (f != null) {
    writer.writeMessage(
      9,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
};


/**
 * optional string session_id = 1;
 * @return {string}
 */
proto.homeflix.PlaybackStatus.prototype.getSessionId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackStatus} returns this
 */
proto.homeflix.PlaybackStatus.prototype.setSessionId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_id = 2;
 * @return {string}
 */
proto.homeflix.PlaybackStatus.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackStatus} returns this
 */
proto.homeflix.PlaybackStatus.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string state = 3;
 * @return {string}
 */
proto.homeflix.PlaybackStatus.prototype.getState = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackStatus} returns this
 */
proto.homeflix.PlaybackStatus.prototype.setState = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional int32 current_time = 4;
 * @return {number}
 */
proto.homeflix.PlaybackStatus.prototype.getCurrentTime = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.PlaybackStatus} returns this
 */
proto.homeflix.PlaybackStatus.prototype.setCurrentTime = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional int32 duration = 5;
 * @return {number}
 */
proto.homeflix.PlaybackStatus.prototype.getDuration = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.PlaybackStatus} returns this
 */
proto.homeflix.PlaybackStatus.prototype.setDuration = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


/**
 * optional double volume = 6;
 * @return {number}
 */
proto.homeflix.PlaybackStatus.prototype.getVolume = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 6, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.PlaybackStatus} returns this
 */
proto.homeflix.PlaybackStatus.prototype.setVolume = function(value) {
  return jspb.Message.setProto3FloatField(this, 6, value);
};


/**
 * optional bool muted = 7;
 * @return {boolean}
 */
proto.homeflix.PlaybackStatus.prototype.getMuted = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 7, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.PlaybackStatus} returns this
 */
proto.homeflix.PlaybackStatus.prototype.setMuted = function(value) {
  return jspb.Message.setProto3BooleanField(this, 7, value);
};


/**
 * optional string quality = 8;
 * @return {string}
 */
proto.homeflix.PlaybackStatus.prototype.getQuality = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 8, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackStatus} returns this
 */
proto.homeflix.PlaybackStatus.prototype.setQuality = function(value) {
  return jspb.Message.setProto3StringField(this, 8, value);
};


/**
 * optional google.protobuf.Timestamp timestamp = 9;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.PlaybackStatus.prototype.getTimestamp = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 9));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.PlaybackStatus} returns this
*/
proto.homeflix.PlaybackStatus.prototype.setTimestamp = function(value) {
  return jspb.Message.setWrapperField(this, 9, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.PlaybackStatus} returns this
 */
proto.homeflix.PlaybackStatus.prototype.clearTimestamp = function() {
  return this.setTimestamp(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.PlaybackStatus.prototype.hasTimestamp = function() {
  return jspb.Message.getField(this, 9) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.SyncPlaybackRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.SyncPlaybackRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.SyncPlaybackRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SyncPlaybackRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    userId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    sessionId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    status: (f = msg.getStatus()) && proto.homeflix.PlaybackStatus.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.SyncPlaybackRequest}
 */
proto.homeflix.SyncPlaybackRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.SyncPlaybackRequest;
  return proto.homeflix.SyncPlaybackRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.SyncPlaybackRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.SyncPlaybackRequest}
 */
proto.homeflix.SyncPlaybackRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setSessionId(value);
      break;
    case 3:
      var value = new proto.homeflix.PlaybackStatus;
      reader.readMessage(value,proto.homeflix.PlaybackStatus.deserializeBinaryFromReader);
      msg.setStatus(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.SyncPlaybackRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.SyncPlaybackRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.SyncPlaybackRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SyncPlaybackRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getSessionId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getStatus();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      proto.homeflix.PlaybackStatus.serializeBinaryToWriter
    );
  }
};


/**
 * optional string user_id = 1;
 * @return {string}
 */
proto.homeflix.SyncPlaybackRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.SyncPlaybackRequest} returns this
 */
proto.homeflix.SyncPlaybackRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string session_id = 2;
 * @return {string}
 */
proto.homeflix.SyncPlaybackRequest.prototype.getSessionId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.SyncPlaybackRequest} returns this
 */
proto.homeflix.SyncPlaybackRequest.prototype.setSessionId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional PlaybackStatus status = 3;
 * @return {?proto.homeflix.PlaybackStatus}
 */
proto.homeflix.SyncPlaybackRequest.prototype.getStatus = function() {
  return /** @type{?proto.homeflix.PlaybackStatus} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.PlaybackStatus, 3));
};


/**
 * @param {?proto.homeflix.PlaybackStatus|undefined} value
 * @return {!proto.homeflix.SyncPlaybackRequest} returns this
*/
proto.homeflix.SyncPlaybackRequest.prototype.setStatus = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.SyncPlaybackRequest} returns this
 */
proto.homeflix.SyncPlaybackRequest.prototype.clearStatus = function() {
  return this.setStatus(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.SyncPlaybackRequest.prototype.hasStatus = function() {
  return jspb.Message.getField(this, 3) != null;
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.SyncPlaybackResponse.repeatedFields_ = [2];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.SyncPlaybackResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.SyncPlaybackResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.SyncPlaybackResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SyncPlaybackResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    success: jspb.Message.getBooleanFieldWithDefault(msg, 1, false),
    syncedDevicesList: (f = jspb.Message.getRepeatedField(msg, 2)) == null ? undefined : f
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.SyncPlaybackResponse}
 */
proto.homeflix.SyncPlaybackResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.SyncPlaybackResponse;
  return proto.homeflix.SyncPlaybackResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.SyncPlaybackResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.SyncPlaybackResponse}
 */
proto.homeflix.SyncPlaybackResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setSuccess(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.addSyncedDevices(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.SyncPlaybackResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.SyncPlaybackResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.SyncPlaybackResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SyncPlaybackResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSuccess();
  if (f) {
    writer.writeBool(
      1,
      f
    );
  }
  f = message.getSyncedDevicesList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      2,
      f
    );
  }
};


/**
 * optional bool success = 1;
 * @return {boolean}
 */
proto.homeflix.SyncPlaybackResponse.prototype.getSuccess = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 1, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.SyncPlaybackResponse} returns this
 */
proto.homeflix.SyncPlaybackResponse.prototype.setSuccess = function(value) {
  return jspb.Message.setProto3BooleanField(this, 1, value);
};


/**
 * repeated string synced_devices = 2;
 * @return {!Array<string>}
 */
proto.homeflix.SyncPlaybackResponse.prototype.getSyncedDevicesList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 2));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.SyncPlaybackResponse} returns this
 */
proto.homeflix.SyncPlaybackResponse.prototype.setSyncedDevicesList = function(value) {
  return jspb.Message.setField(this, 2, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.SyncPlaybackResponse} returns this
 */
proto.homeflix.SyncPlaybackResponse.prototype.addSyncedDevices = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 2, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.SyncPlaybackResponse} returns this
 */
proto.homeflix.SyncPlaybackResponse.prototype.clearSyncedDevicesList = function() {
  return this.setSyncedDevicesList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PlaybackStateRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PlaybackStateRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PlaybackStateRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PlaybackStateRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    sessionId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    userId: jspb.Message.getFieldWithDefault(msg, 2, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PlaybackStateRequest}
 */
proto.homeflix.PlaybackStateRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PlaybackStateRequest;
  return proto.homeflix.PlaybackStateRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PlaybackStateRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PlaybackStateRequest}
 */
proto.homeflix.PlaybackStateRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setSessionId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PlaybackStateRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PlaybackStateRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PlaybackStateRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PlaybackStateRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSessionId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
};


/**
 * optional string session_id = 1;
 * @return {string}
 */
proto.homeflix.PlaybackStateRequest.prototype.getSessionId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackStateRequest} returns this
 */
proto.homeflix.PlaybackStateRequest.prototype.setSessionId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string user_id = 2;
 * @return {string}
 */
proto.homeflix.PlaybackStateRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackStateRequest} returns this
 */
proto.homeflix.PlaybackStateRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.PlaybackState.repeatedFields_ = [5];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.PlaybackState.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.PlaybackState.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.PlaybackState} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PlaybackState.toObject = function(includeInstance, msg) {
  var f, obj = {
    sessionId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    mediaId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 3, ""),
    status: (f = msg.getStatus()) && proto.homeflix.PlaybackStatus.toObject(includeInstance, f),
    connectedDevicesList: (f = jspb.Message.getRepeatedField(msg, 5)) == null ? undefined : f
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.PlaybackState}
 */
proto.homeflix.PlaybackState.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.PlaybackState;
  return proto.homeflix.PlaybackState.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.PlaybackState} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.PlaybackState}
 */
proto.homeflix.PlaybackState.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setSessionId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 4:
      var value = new proto.homeflix.PlaybackStatus;
      reader.readMessage(value,proto.homeflix.PlaybackStatus.deserializeBinaryFromReader);
      msg.setStatus(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.addConnectedDevices(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.PlaybackState.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.PlaybackState.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.PlaybackState} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.PlaybackState.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSessionId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getStatus();
  if (f != null) {
    writer.writeMessage(
      4,
      f,
      proto.homeflix.PlaybackStatus.serializeBinaryToWriter
    );
  }
  f = message.getConnectedDevicesList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      5,
      f
    );
  }
};


/**
 * optional string session_id = 1;
 * @return {string}
 */
proto.homeflix.PlaybackState.prototype.getSessionId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackState} returns this
 */
proto.homeflix.PlaybackState.prototype.setSessionId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string media_id = 2;
 * @return {string}
 */
proto.homeflix.PlaybackState.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackState} returns this
 */
proto.homeflix.PlaybackState.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string media_type = 3;
 * @return {string}
 */
proto.homeflix.PlaybackState.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.PlaybackState} returns this
 */
proto.homeflix.PlaybackState.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional PlaybackStatus status = 4;
 * @return {?proto.homeflix.PlaybackStatus}
 */
proto.homeflix.PlaybackState.prototype.getStatus = function() {
  return /** @type{?proto.homeflix.PlaybackStatus} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.PlaybackStatus, 4));
};


/**
 * @param {?proto.homeflix.PlaybackStatus|undefined} value
 * @return {!proto.homeflix.PlaybackState} returns this
*/
proto.homeflix.PlaybackState.prototype.setStatus = function(value) {
  return jspb.Message.setWrapperField(this, 4, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.PlaybackState} returns this
 */
proto.homeflix.PlaybackState.prototype.clearStatus = function() {
  return this.setStatus(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.PlaybackState.prototype.hasStatus = function() {
  return jspb.Message.getField(this, 4) != null;
};


/**
 * repeated string connected_devices = 5;
 * @return {!Array<string>}
 */
proto.homeflix.PlaybackState.prototype.getConnectedDevicesList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 5));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.PlaybackState} returns this
 */
proto.homeflix.PlaybackState.prototype.setConnectedDevicesList = function(value) {
  return jspb.Message.setField(this, 5, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.PlaybackState} returns this
 */
proto.homeflix.PlaybackState.prototype.addConnectedDevices = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 5, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.PlaybackState} returns this
 */
proto.homeflix.PlaybackState.prototype.clearConnectedDevicesList = function() {
  return this.setConnectedDevicesList([]);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.SystemHealth.repeatedFields_ = [9,10];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.SystemHealth.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.SystemHealth.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.SystemHealth} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SystemHealth.toObject = function(includeInstance, msg) {
  var f, obj = {
    status: jspb.Message.getFieldWithDefault(msg, 1, ""),
    cpuUsage: jspb.Message.getFloatingPointFieldWithDefault(msg, 2, 0.0),
    memoryUsage: jspb.Message.getFloatingPointFieldWithDefault(msg, 3, 0.0),
    diskUsage: jspb.Message.getFloatingPointFieldWithDefault(msg, 4, 0.0),
    activeStreams: jspb.Message.getFieldWithDefault(msg, 5, 0),
    totalUsers: jspb.Message.getFieldWithDefault(msg, 6, 0),
    totalMediaItems: jspb.Message.getFieldWithDefault(msg, 7, 0),
    lastScan: (f = msg.getLastScan()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    warningsList: (f = jspb.Message.getRepeatedField(msg, 9)) == null ? undefined : f,
    errorsList: (f = jspb.Message.getRepeatedField(msg, 10)) == null ? undefined : f
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.SystemHealth}
 */
proto.homeflix.SystemHealth.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.SystemHealth;
  return proto.homeflix.SystemHealth.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.SystemHealth} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.SystemHealth}
 */
proto.homeflix.SystemHealth.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setStatus(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setCpuUsage(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setMemoryUsage(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setDiskUsage(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setActiveStreams(value);
      break;
    case 6:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalUsers(value);
      break;
    case 7:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalMediaItems(value);
      break;
    case 8:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setLastScan(value);
      break;
    case 9:
      var value = /** @type {string} */ (reader.readString());
      msg.addWarnings(value);
      break;
    case 10:
      var value = /** @type {string} */ (reader.readString());
      msg.addErrors(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.SystemHealth.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.SystemHealth.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.SystemHealth} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.SystemHealth.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getStatus();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getCpuUsage();
  if (f !== 0.0) {
    writer.writeDouble(
      2,
      f
    );
  }
  f = message.getMemoryUsage();
  if (f !== 0.0) {
    writer.writeDouble(
      3,
      f
    );
  }
  f = message.getDiskUsage();
  if (f !== 0.0) {
    writer.writeDouble(
      4,
      f
    );
  }
  f = message.getActiveStreams();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
  f = message.getTotalUsers();
  if (f !== 0) {
    writer.writeInt32(
      6,
      f
    );
  }
  f = message.getTotalMediaItems();
  if (f !== 0) {
    writer.writeInt32(
      7,
      f
    );
  }
  f = message.getLastScan();
  if (f != null) {
    writer.writeMessage(
      8,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getWarningsList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      9,
      f
    );
  }
  f = message.getErrorsList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      10,
      f
    );
  }
};


/**
 * optional string status = 1;
 * @return {string}
 */
proto.homeflix.SystemHealth.prototype.getStatus = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.setStatus = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional double cpu_usage = 2;
 * @return {number}
 */
proto.homeflix.SystemHealth.prototype.getCpuUsage = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 2, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.setCpuUsage = function(value) {
  return jspb.Message.setProto3FloatField(this, 2, value);
};


/**
 * optional double memory_usage = 3;
 * @return {number}
 */
proto.homeflix.SystemHealth.prototype.getMemoryUsage = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 3, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.setMemoryUsage = function(value) {
  return jspb.Message.setProto3FloatField(this, 3, value);
};


/**
 * optional double disk_usage = 4;
 * @return {number}
 */
proto.homeflix.SystemHealth.prototype.getDiskUsage = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 4, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.setDiskUsage = function(value) {
  return jspb.Message.setProto3FloatField(this, 4, value);
};


/**
 * optional int32 active_streams = 5;
 * @return {number}
 */
proto.homeflix.SystemHealth.prototype.getActiveStreams = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.setActiveStreams = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


/**
 * optional int32 total_users = 6;
 * @return {number}
 */
proto.homeflix.SystemHealth.prototype.getTotalUsers = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 6, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.setTotalUsers = function(value) {
  return jspb.Message.setProto3IntField(this, 6, value);
};


/**
 * optional int32 total_media_items = 7;
 * @return {number}
 */
proto.homeflix.SystemHealth.prototype.getTotalMediaItems = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 7, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.setTotalMediaItems = function(value) {
  return jspb.Message.setProto3IntField(this, 7, value);
};


/**
 * optional google.protobuf.Timestamp last_scan = 8;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.SystemHealth.prototype.getLastScan = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 8));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.SystemHealth} returns this
*/
proto.homeflix.SystemHealth.prototype.setLastScan = function(value) {
  return jspb.Message.setWrapperField(this, 8, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.clearLastScan = function() {
  return this.setLastScan(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.SystemHealth.prototype.hasLastScan = function() {
  return jspb.Message.getField(this, 8) != null;
};


/**
 * repeated string warnings = 9;
 * @return {!Array<string>}
 */
proto.homeflix.SystemHealth.prototype.getWarningsList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 9));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.setWarningsList = function(value) {
  return jspb.Message.setField(this, 9, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.addWarnings = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 9, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.clearWarningsList = function() {
  return this.setWarningsList([]);
};


/**
 * repeated string errors = 10;
 * @return {!Array<string>}
 */
proto.homeflix.SystemHealth.prototype.getErrorsList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 10));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.setErrorsList = function(value) {
  return jspb.Message.setField(this, 10, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.addErrors = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 10, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.SystemHealth} returns this
 */
proto.homeflix.SystemHealth.prototype.clearErrorsList = function() {
  return this.setErrorsList([]);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.StreamingMetrics.repeatedFields_ = [5];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.StreamingMetrics.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.StreamingMetrics.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.StreamingMetrics} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamingMetrics.toObject = function(includeInstance, msg) {
  var f, obj = {
    activeStreams: jspb.Message.getFieldWithDefault(msg, 1, 0),
    totalStreamsToday: jspb.Message.getFieldWithDefault(msg, 2, 0),
    averageBitrate: jspb.Message.getFloatingPointFieldWithDefault(msg, 3, 0.0),
    peakConcurrentStreams: jspb.Message.getFloatingPointFieldWithDefault(msg, 4, 0.0),
    activeSessionsList: jspb.Message.toObjectList(msg.getActiveSessionsList(),
    proto.homeflix.StreamingSession.toObject, includeInstance),
    qualityDistributionMap: (f = msg.getQualityDistributionMap()) ? f.toObject(includeInstance, undefined) : [],
    codecDistributionMap: (f = msg.getCodecDistributionMap()) ? f.toObject(includeInstance, undefined) : []
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.StreamingMetrics}
 */
proto.homeflix.StreamingMetrics.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.StreamingMetrics;
  return proto.homeflix.StreamingMetrics.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.StreamingMetrics} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.StreamingMetrics}
 */
proto.homeflix.StreamingMetrics.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setActiveStreams(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalStreamsToday(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setAverageBitrate(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setPeakConcurrentStreams(value);
      break;
    case 5:
      var value = new proto.homeflix.StreamingSession;
      reader.readMessage(value,proto.homeflix.StreamingSession.deserializeBinaryFromReader);
      msg.addActiveSessions(value);
      break;
    case 6:
      var value = msg.getQualityDistributionMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readInt32, null, "", 0);
         });
      break;
    case 7:
      var value = msg.getCodecDistributionMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readInt32, null, "", 0);
         });
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.StreamingMetrics.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.StreamingMetrics.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.StreamingMetrics} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamingMetrics.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getActiveStreams();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getTotalStreamsToday();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getAverageBitrate();
  if (f !== 0.0) {
    writer.writeDouble(
      3,
      f
    );
  }
  f = message.getPeakConcurrentStreams();
  if (f !== 0.0) {
    writer.writeDouble(
      4,
      f
    );
  }
  f = message.getActiveSessionsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      5,
      f,
      proto.homeflix.StreamingSession.serializeBinaryToWriter
    );
  }
  f = message.getQualityDistributionMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(6, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeInt32);
  }
  f = message.getCodecDistributionMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(7, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeInt32);
  }
};


/**
 * optional int32 active_streams = 1;
 * @return {number}
 */
proto.homeflix.StreamingMetrics.prototype.getActiveStreams = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamingMetrics} returns this
 */
proto.homeflix.StreamingMetrics.prototype.setActiveStreams = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional int32 total_streams_today = 2;
 * @return {number}
 */
proto.homeflix.StreamingMetrics.prototype.getTotalStreamsToday = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamingMetrics} returns this
 */
proto.homeflix.StreamingMetrics.prototype.setTotalStreamsToday = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional double average_bitrate = 3;
 * @return {number}
 */
proto.homeflix.StreamingMetrics.prototype.getAverageBitrate = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 3, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamingMetrics} returns this
 */
proto.homeflix.StreamingMetrics.prototype.setAverageBitrate = function(value) {
  return jspb.Message.setProto3FloatField(this, 3, value);
};


/**
 * optional double peak_concurrent_streams = 4;
 * @return {number}
 */
proto.homeflix.StreamingMetrics.prototype.getPeakConcurrentStreams = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 4, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamingMetrics} returns this
 */
proto.homeflix.StreamingMetrics.prototype.setPeakConcurrentStreams = function(value) {
  return jspb.Message.setProto3FloatField(this, 4, value);
};


/**
 * repeated StreamingSession active_sessions = 5;
 * @return {!Array<!proto.homeflix.StreamingSession>}
 */
proto.homeflix.StreamingMetrics.prototype.getActiveSessionsList = function() {
  return /** @type{!Array<!proto.homeflix.StreamingSession>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.StreamingSession, 5));
};


/**
 * @param {!Array<!proto.homeflix.StreamingSession>} value
 * @return {!proto.homeflix.StreamingMetrics} returns this
*/
proto.homeflix.StreamingMetrics.prototype.setActiveSessionsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 5, value);
};


/**
 * @param {!proto.homeflix.StreamingSession=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.StreamingSession}
 */
proto.homeflix.StreamingMetrics.prototype.addActiveSessions = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 5, opt_value, proto.homeflix.StreamingSession, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.StreamingMetrics} returns this
 */
proto.homeflix.StreamingMetrics.prototype.clearActiveSessionsList = function() {
  return this.setActiveSessionsList([]);
};


/**
 * map<string, int32> quality_distribution = 6;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,number>}
 */
proto.homeflix.StreamingMetrics.prototype.getQualityDistributionMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,number>} */ (
      jspb.Message.getMapField(this, 6, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.homeflix.StreamingMetrics} returns this
 */
proto.homeflix.StreamingMetrics.prototype.clearQualityDistributionMap = function() {
  this.getQualityDistributionMap().clear();
  return this;};


/**
 * map<string, int32> codec_distribution = 7;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,number>}
 */
proto.homeflix.StreamingMetrics.prototype.getCodecDistributionMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,number>} */ (
      jspb.Message.getMapField(this, 7, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.homeflix.StreamingMetrics} returns this
 */
proto.homeflix.StreamingMetrics.prototype.clearCodecDistributionMap = function() {
  this.getCodecDistributionMap().clear();
  return this;};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.StreamingSession.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.StreamingSession.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.StreamingSession} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamingSession.toObject = function(includeInstance, msg) {
  var f, obj = {
    sessionId: jspb.Message.getFieldWithDefault(msg, 1, ""),
    userId: jspb.Message.getFieldWithDefault(msg, 2, ""),
    mediaId: jspb.Message.getFieldWithDefault(msg, 3, ""),
    mediaType: jspb.Message.getFieldWithDefault(msg, 4, ""),
    quality: jspb.Message.getFieldWithDefault(msg, 5, ""),
    bitrate: jspb.Message.getFloatingPointFieldWithDefault(msg, 6, 0.0),
    startedAt: (f = msg.getStartedAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    durationSeconds: jspb.Message.getFieldWithDefault(msg, 8, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.StreamingSession}
 */
proto.homeflix.StreamingSession.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.StreamingSession;
  return proto.homeflix.StreamingSession.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.StreamingSession} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.StreamingSession}
 */
proto.homeflix.StreamingSession.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setSessionId(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaId(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setMediaType(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setQuality(value);
      break;
    case 6:
      var value = /** @type {number} */ (reader.readDouble());
      msg.setBitrate(value);
      break;
    case 7:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setStartedAt(value);
      break;
    case 8:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setDurationSeconds(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.StreamingSession.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.StreamingSession.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.StreamingSession} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.StreamingSession.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getSessionId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getMediaId();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getMediaType();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getQuality();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
  f = message.getBitrate();
  if (f !== 0.0) {
    writer.writeDouble(
      6,
      f
    );
  }
  f = message.getStartedAt();
  if (f != null) {
    writer.writeMessage(
      7,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getDurationSeconds();
  if (f !== 0) {
    writer.writeInt32(
      8,
      f
    );
  }
};


/**
 * optional string session_id = 1;
 * @return {string}
 */
proto.homeflix.StreamingSession.prototype.getSessionId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamingSession} returns this
 */
proto.homeflix.StreamingSession.prototype.setSessionId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string user_id = 2;
 * @return {string}
 */
proto.homeflix.StreamingSession.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamingSession} returns this
 */
proto.homeflix.StreamingSession.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string media_id = 3;
 * @return {string}
 */
proto.homeflix.StreamingSession.prototype.getMediaId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamingSession} returns this
 */
proto.homeflix.StreamingSession.prototype.setMediaId = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string media_type = 4;
 * @return {string}
 */
proto.homeflix.StreamingSession.prototype.getMediaType = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamingSession} returns this
 */
proto.homeflix.StreamingSession.prototype.setMediaType = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional string quality = 5;
 * @return {string}
 */
proto.homeflix.StreamingSession.prototype.getQuality = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.StreamingSession} returns this
 */
proto.homeflix.StreamingSession.prototype.setQuality = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};


/**
 * optional double bitrate = 6;
 * @return {number}
 */
proto.homeflix.StreamingSession.prototype.getBitrate = function() {
  return /** @type {number} */ (jspb.Message.getFloatingPointFieldWithDefault(this, 6, 0.0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamingSession} returns this
 */
proto.homeflix.StreamingSession.prototype.setBitrate = function(value) {
  return jspb.Message.setProto3FloatField(this, 6, value);
};


/**
 * optional google.protobuf.Timestamp started_at = 7;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.StreamingSession.prototype.getStartedAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 7));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.StreamingSession} returns this
*/
proto.homeflix.StreamingSession.prototype.setStartedAt = function(value) {
  return jspb.Message.setWrapperField(this, 7, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.StreamingSession} returns this
 */
proto.homeflix.StreamingSession.prototype.clearStartedAt = function() {
  return this.setStartedAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.StreamingSession.prototype.hasStartedAt = function() {
  return jspb.Message.getField(this, 7) != null;
};


/**
 * optional int32 duration_seconds = 8;
 * @return {number}
 */
proto.homeflix.StreamingSession.prototype.getDurationSeconds = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 8, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.StreamingSession} returns this
 */
proto.homeflix.StreamingSession.prototype.setDurationSeconds = function(value) {
  return jspb.Message.setProto3IntField(this, 8, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.ScanLibraryRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.ScanLibraryRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.ScanLibraryRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.ScanLibraryRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    path: jspb.Message.getFieldWithDefault(msg, 1, ""),
    forceRescan: jspb.Message.getBooleanFieldWithDefault(msg, 2, false)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.ScanLibraryRequest}
 */
proto.homeflix.ScanLibraryRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.ScanLibraryRequest;
  return proto.homeflix.ScanLibraryRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.ScanLibraryRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.ScanLibraryRequest}
 */
proto.homeflix.ScanLibraryRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setPath(value);
      break;
    case 2:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setForceRescan(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.ScanLibraryRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.ScanLibraryRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.ScanLibraryRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.ScanLibraryRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getPath();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getForceRescan();
  if (f) {
    writer.writeBool(
      2,
      f
    );
  }
};


/**
 * optional string path = 1;
 * @return {string}
 */
proto.homeflix.ScanLibraryRequest.prototype.getPath = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.ScanLibraryRequest} returns this
 */
proto.homeflix.ScanLibraryRequest.prototype.setPath = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional bool force_rescan = 2;
 * @return {boolean}
 */
proto.homeflix.ScanLibraryRequest.prototype.getForceRescan = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 2, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.ScanLibraryRequest} returns this
 */
proto.homeflix.ScanLibraryRequest.prototype.setForceRescan = function(value) {
  return jspb.Message.setProto3BooleanField(this, 2, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.ScanProgress.repeatedFields_ = [6];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.ScanProgress.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.ScanProgress.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.ScanProgress} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.ScanProgress.toObject = function(includeInstance, msg) {
  var f, obj = {
    status: jspb.Message.getFieldWithDefault(msg, 1, ""),
    filesScanned: jspb.Message.getFieldWithDefault(msg, 2, 0),
    totalFiles: jspb.Message.getFieldWithDefault(msg, 3, 0),
    newItemsFound: jspb.Message.getFieldWithDefault(msg, 4, 0),
    currentFile: jspb.Message.getFieldWithDefault(msg, 5, ""),
    errorsList: (f = jspb.Message.getRepeatedField(msg, 6)) == null ? undefined : f,
    startedAt: (f = msg.getStartedAt()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.ScanProgress}
 */
proto.homeflix.ScanProgress.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.ScanProgress;
  return proto.homeflix.ScanProgress.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.ScanProgress} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.ScanProgress}
 */
proto.homeflix.ScanProgress.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setStatus(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setFilesScanned(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalFiles(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setNewItemsFound(value);
      break;
    case 5:
      var value = /** @type {string} */ (reader.readString());
      msg.setCurrentFile(value);
      break;
    case 6:
      var value = /** @type {string} */ (reader.readString());
      msg.addErrors(value);
      break;
    case 7:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setStartedAt(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.ScanProgress.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.ScanProgress.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.ScanProgress} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.ScanProgress.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getStatus();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getFilesScanned();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getTotalFiles();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getNewItemsFound();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
  f = message.getCurrentFile();
  if (f.length > 0) {
    writer.writeString(
      5,
      f
    );
  }
  f = message.getErrorsList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      6,
      f
    );
  }
  f = message.getStartedAt();
  if (f != null) {
    writer.writeMessage(
      7,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
};


/**
 * optional string status = 1;
 * @return {string}
 */
proto.homeflix.ScanProgress.prototype.getStatus = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.ScanProgress} returns this
 */
proto.homeflix.ScanProgress.prototype.setStatus = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional int32 files_scanned = 2;
 * @return {number}
 */
proto.homeflix.ScanProgress.prototype.getFilesScanned = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.ScanProgress} returns this
 */
proto.homeflix.ScanProgress.prototype.setFilesScanned = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional int32 total_files = 3;
 * @return {number}
 */
proto.homeflix.ScanProgress.prototype.getTotalFiles = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.ScanProgress} returns this
 */
proto.homeflix.ScanProgress.prototype.setTotalFiles = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional int32 new_items_found = 4;
 * @return {number}
 */
proto.homeflix.ScanProgress.prototype.getNewItemsFound = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.ScanProgress} returns this
 */
proto.homeflix.ScanProgress.prototype.setNewItemsFound = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional string current_file = 5;
 * @return {string}
 */
proto.homeflix.ScanProgress.prototype.getCurrentFile = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 5, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.ScanProgress} returns this
 */
proto.homeflix.ScanProgress.prototype.setCurrentFile = function(value) {
  return jspb.Message.setProto3StringField(this, 5, value);
};


/**
 * repeated string errors = 6;
 * @return {!Array<string>}
 */
proto.homeflix.ScanProgress.prototype.getErrorsList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 6));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.homeflix.ScanProgress} returns this
 */
proto.homeflix.ScanProgress.prototype.setErrorsList = function(value) {
  return jspb.Message.setField(this, 6, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.homeflix.ScanProgress} returns this
 */
proto.homeflix.ScanProgress.prototype.addErrors = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 6, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.ScanProgress} returns this
 */
proto.homeflix.ScanProgress.prototype.clearErrorsList = function() {
  return this.setErrorsList([]);
};


/**
 * optional google.protobuf.Timestamp started_at = 7;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.ScanProgress.prototype.getStartedAt = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 7));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.ScanProgress} returns this
*/
proto.homeflix.ScanProgress.prototype.setStartedAt = function(value) {
  return jspb.Message.setWrapperField(this, 7, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.ScanProgress} returns this
 */
proto.homeflix.ScanProgress.prototype.clearStartedAt = function() {
  return this.setStartedAt(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.ScanProgress.prototype.hasStartedAt = function() {
  return jspb.Message.getField(this, 7) != null;
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.ScanStatus.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.ScanStatus.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.ScanStatus} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.ScanStatus.toObject = function(includeInstance, msg) {
  var f, obj = {
    isScanning: jspb.Message.getBooleanFieldWithDefault(msg, 1, false),
    currentScan: (f = msg.getCurrentScan()) && proto.homeflix.ScanProgress.toObject(includeInstance, f),
    lastScan: (f = msg.getLastScan()) && google_protobuf_timestamp_pb.Timestamp.toObject(includeInstance, f),
    totalMediaItems: jspb.Message.getFieldWithDefault(msg, 4, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.ScanStatus}
 */
proto.homeflix.ScanStatus.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.ScanStatus;
  return proto.homeflix.ScanStatus.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.ScanStatus} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.ScanStatus}
 */
proto.homeflix.ScanStatus.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setIsScanning(value);
      break;
    case 2:
      var value = new proto.homeflix.ScanProgress;
      reader.readMessage(value,proto.homeflix.ScanProgress.deserializeBinaryFromReader);
      msg.setCurrentScan(value);
      break;
    case 3:
      var value = new google_protobuf_timestamp_pb.Timestamp;
      reader.readMessage(value,google_protobuf_timestamp_pb.Timestamp.deserializeBinaryFromReader);
      msg.setLastScan(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalMediaItems(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.ScanStatus.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.ScanStatus.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.ScanStatus} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.ScanStatus.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getIsScanning();
  if (f) {
    writer.writeBool(
      1,
      f
    );
  }
  f = message.getCurrentScan();
  if (f != null) {
    writer.writeMessage(
      2,
      f,
      proto.homeflix.ScanProgress.serializeBinaryToWriter
    );
  }
  f = message.getLastScan();
  if (f != null) {
    writer.writeMessage(
      3,
      f,
      google_protobuf_timestamp_pb.Timestamp.serializeBinaryToWriter
    );
  }
  f = message.getTotalMediaItems();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
};


/**
 * optional bool is_scanning = 1;
 * @return {boolean}
 */
proto.homeflix.ScanStatus.prototype.getIsScanning = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 1, false));
};


/**
 * @param {boolean} value
 * @return {!proto.homeflix.ScanStatus} returns this
 */
proto.homeflix.ScanStatus.prototype.setIsScanning = function(value) {
  return jspb.Message.setProto3BooleanField(this, 1, value);
};


/**
 * optional ScanProgress current_scan = 2;
 * @return {?proto.homeflix.ScanProgress}
 */
proto.homeflix.ScanStatus.prototype.getCurrentScan = function() {
  return /** @type{?proto.homeflix.ScanProgress} */ (
    jspb.Message.getWrapperField(this, proto.homeflix.ScanProgress, 2));
};


/**
 * @param {?proto.homeflix.ScanProgress|undefined} value
 * @return {!proto.homeflix.ScanStatus} returns this
*/
proto.homeflix.ScanStatus.prototype.setCurrentScan = function(value) {
  return jspb.Message.setWrapperField(this, 2, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.ScanStatus} returns this
 */
proto.homeflix.ScanStatus.prototype.clearCurrentScan = function() {
  return this.setCurrentScan(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.ScanStatus.prototype.hasCurrentScan = function() {
  return jspb.Message.getField(this, 2) != null;
};


/**
 * optional google.protobuf.Timestamp last_scan = 3;
 * @return {?proto.google.protobuf.Timestamp}
 */
proto.homeflix.ScanStatus.prototype.getLastScan = function() {
  return /** @type{?proto.google.protobuf.Timestamp} */ (
    jspb.Message.getWrapperField(this, google_protobuf_timestamp_pb.Timestamp, 3));
};


/**
 * @param {?proto.google.protobuf.Timestamp|undefined} value
 * @return {!proto.homeflix.ScanStatus} returns this
*/
proto.homeflix.ScanStatus.prototype.setLastScan = function(value) {
  return jspb.Message.setWrapperField(this, 3, value);
};


/**
 * Clears the message field making it undefined.
 * @return {!proto.homeflix.ScanStatus} returns this
 */
proto.homeflix.ScanStatus.prototype.clearLastScan = function() {
  return this.setLastScan(undefined);
};


/**
 * Returns whether this field is set.
 * @return {boolean}
 */
proto.homeflix.ScanStatus.prototype.hasLastScan = function() {
  return jspb.Message.getField(this, 3) != null;
};


/**
 * optional int32 total_media_items = 4;
 * @return {number}
 */
proto.homeflix.ScanStatus.prototype.getTotalMediaItems = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.ScanStatus} returns this
 */
proto.homeflix.ScanStatus.prototype.setTotalMediaItems = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.AdminPreviewQueue.repeatedFields_ = [6];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.AdminPreviewQueue.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.AdminPreviewQueue.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.AdminPreviewQueue} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.AdminPreviewQueue.toObject = function(includeInstance, msg) {
  var f, obj = {
    totalJobs: jspb.Message.getFieldWithDefault(msg, 1, 0),
    pendingJobs: jspb.Message.getFieldWithDefault(msg, 2, 0),
    processingJobs: jspb.Message.getFieldWithDefault(msg, 3, 0),
    completedJobs: jspb.Message.getFieldWithDefault(msg, 4, 0),
    failedJobs: jspb.Message.getFieldWithDefault(msg, 5, 0),
    recentJobsList: jspb.Message.toObjectList(msg.getRecentJobsList(),
    proto.homeflix.PreviewJob.toObject, includeInstance),
    jobStatsMap: (f = msg.getJobStatsMap()) ? f.toObject(includeInstance, undefined) : []
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.AdminPreviewQueue}
 */
proto.homeflix.AdminPreviewQueue.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.AdminPreviewQueue;
  return proto.homeflix.AdminPreviewQueue.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.AdminPreviewQueue} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.AdminPreviewQueue}
 */
proto.homeflix.AdminPreviewQueue.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalJobs(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setPendingJobs(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setProcessingJobs(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setCompletedJobs(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setFailedJobs(value);
      break;
    case 6:
      var value = new proto.homeflix.PreviewJob;
      reader.readMessage(value,proto.homeflix.PreviewJob.deserializeBinaryFromReader);
      msg.addRecentJobs(value);
      break;
    case 7:
      var value = msg.getJobStatsMap();
      reader.readMessage(value, function(message, reader) {
        jspb.Map.deserializeBinary(message, reader, jspb.BinaryReader.prototype.readString, jspb.BinaryReader.prototype.readInt32, null, "", 0);
         });
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.AdminPreviewQueue.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.AdminPreviewQueue.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.AdminPreviewQueue} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.AdminPreviewQueue.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getTotalJobs();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getPendingJobs();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getProcessingJobs();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getCompletedJobs();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
  f = message.getFailedJobs();
  if (f !== 0) {
    writer.writeInt32(
      5,
      f
    );
  }
  f = message.getRecentJobsList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      6,
      f,
      proto.homeflix.PreviewJob.serializeBinaryToWriter
    );
  }
  f = message.getJobStatsMap(true);
  if (f && f.getLength() > 0) {
    f.serializeBinary(7, writer, jspb.BinaryWriter.prototype.writeString, jspb.BinaryWriter.prototype.writeInt32);
  }
};


/**
 * optional int32 total_jobs = 1;
 * @return {number}
 */
proto.homeflix.AdminPreviewQueue.prototype.getTotalJobs = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.AdminPreviewQueue} returns this
 */
proto.homeflix.AdminPreviewQueue.prototype.setTotalJobs = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional int32 pending_jobs = 2;
 * @return {number}
 */
proto.homeflix.AdminPreviewQueue.prototype.getPendingJobs = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.AdminPreviewQueue} returns this
 */
proto.homeflix.AdminPreviewQueue.prototype.setPendingJobs = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional int32 processing_jobs = 3;
 * @return {number}
 */
proto.homeflix.AdminPreviewQueue.prototype.getProcessingJobs = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.AdminPreviewQueue} returns this
 */
proto.homeflix.AdminPreviewQueue.prototype.setProcessingJobs = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional int32 completed_jobs = 4;
 * @return {number}
 */
proto.homeflix.AdminPreviewQueue.prototype.getCompletedJobs = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.AdminPreviewQueue} returns this
 */
proto.homeflix.AdminPreviewQueue.prototype.setCompletedJobs = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};


/**
 * optional int32 failed_jobs = 5;
 * @return {number}
 */
proto.homeflix.AdminPreviewQueue.prototype.getFailedJobs = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.AdminPreviewQueue} returns this
 */
proto.homeflix.AdminPreviewQueue.prototype.setFailedJobs = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


/**
 * repeated PreviewJob recent_jobs = 6;
 * @return {!Array<!proto.homeflix.PreviewJob>}
 */
proto.homeflix.AdminPreviewQueue.prototype.getRecentJobsList = function() {
  return /** @type{!Array<!proto.homeflix.PreviewJob>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.PreviewJob, 6));
};


/**
 * @param {!Array<!proto.homeflix.PreviewJob>} value
 * @return {!proto.homeflix.AdminPreviewQueue} returns this
*/
proto.homeflix.AdminPreviewQueue.prototype.setRecentJobsList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 6, value);
};


/**
 * @param {!proto.homeflix.PreviewJob=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.PreviewJob}
 */
proto.homeflix.AdminPreviewQueue.prototype.addRecentJobs = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 6, opt_value, proto.homeflix.PreviewJob, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.AdminPreviewQueue} returns this
 */
proto.homeflix.AdminPreviewQueue.prototype.clearRecentJobsList = function() {
  return this.setRecentJobsList([]);
};


/**
 * map<string, int32> job_stats = 7;
 * @param {boolean=} opt_noLazyCreate Do not create the map if
 * empty, instead returning `undefined`
 * @return {!jspb.Map<string,number>}
 */
proto.homeflix.AdminPreviewQueue.prototype.getJobStatsMap = function(opt_noLazyCreate) {
  return /** @type {!jspb.Map<string,number>} */ (
      jspb.Message.getMapField(this, 7, opt_noLazyCreate,
      null));
};


/**
 * Clears values from the map. The map will be non-null.
 * @return {!proto.homeflix.AdminPreviewQueue} returns this
 */
proto.homeflix.AdminPreviewQueue.prototype.clearJobStatsMap = function() {
  this.getJobStatsMap().clear();
  return this;};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetAllUsersRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetAllUsersRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetAllUsersRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetAllUsersRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    page: jspb.Message.getFieldWithDefault(msg, 1, 0),
    limit: jspb.Message.getFieldWithDefault(msg, 2, 0),
    sortBy: jspb.Message.getFieldWithDefault(msg, 3, ""),
    sortOrder: jspb.Message.getFieldWithDefault(msg, 4, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetAllUsersRequest}
 */
proto.homeflix.GetAllUsersRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetAllUsersRequest;
  return proto.homeflix.GetAllUsersRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetAllUsersRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetAllUsersRequest}
 */
proto.homeflix.GetAllUsersRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setPage(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setSortBy(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setSortOrder(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetAllUsersRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetAllUsersRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetAllUsersRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetAllUsersRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getPage();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getSortBy();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getSortOrder();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
};


/**
 * optional int32 page = 1;
 * @return {number}
 */
proto.homeflix.GetAllUsersRequest.prototype.getPage = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetAllUsersRequest} returns this
 */
proto.homeflix.GetAllUsersRequest.prototype.setPage = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


/**
 * optional int32 limit = 2;
 * @return {number}
 */
proto.homeflix.GetAllUsersRequest.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetAllUsersRequest} returns this
 */
proto.homeflix.GetAllUsersRequest.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional string sort_by = 3;
 * @return {string}
 */
proto.homeflix.GetAllUsersRequest.prototype.getSortBy = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetAllUsersRequest} returns this
 */
proto.homeflix.GetAllUsersRequest.prototype.setSortBy = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string sort_order = 4;
 * @return {string}
 */
proto.homeflix.GetAllUsersRequest.prototype.getSortOrder = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.GetAllUsersRequest} returns this
 */
proto.homeflix.GetAllUsersRequest.prototype.setSortOrder = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};



/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.homeflix.GetAllUsersResponse.repeatedFields_ = [1];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.GetAllUsersResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.GetAllUsersResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.GetAllUsersResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetAllUsersResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    usersList: jspb.Message.toObjectList(msg.getUsersList(),
    proto.homeflix.User.toObject, includeInstance),
    totalCount: jspb.Message.getFieldWithDefault(msg, 2, 0),
    page: jspb.Message.getFieldWithDefault(msg, 3, 0),
    limit: jspb.Message.getFieldWithDefault(msg, 4, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.GetAllUsersResponse}
 */
proto.homeflix.GetAllUsersResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.GetAllUsersResponse;
  return proto.homeflix.GetAllUsersResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.GetAllUsersResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.GetAllUsersResponse}
 */
proto.homeflix.GetAllUsersResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = new proto.homeflix.User;
      reader.readMessage(value,proto.homeflix.User.deserializeBinaryFromReader);
      msg.addUsers(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setTotalCount(value);
      break;
    case 3:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setPage(value);
      break;
    case 4:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLimit(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.GetAllUsersResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.GetAllUsersResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.GetAllUsersResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.GetAllUsersResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUsersList();
  if (f.length > 0) {
    writer.writeRepeatedMessage(
      1,
      f,
      proto.homeflix.User.serializeBinaryToWriter
    );
  }
  f = message.getTotalCount();
  if (f !== 0) {
    writer.writeInt32(
      2,
      f
    );
  }
  f = message.getPage();
  if (f !== 0) {
    writer.writeInt32(
      3,
      f
    );
  }
  f = message.getLimit();
  if (f !== 0) {
    writer.writeInt32(
      4,
      f
    );
  }
};


/**
 * repeated User users = 1;
 * @return {!Array<!proto.homeflix.User>}
 */
proto.homeflix.GetAllUsersResponse.prototype.getUsersList = function() {
  return /** @type{!Array<!proto.homeflix.User>} */ (
    jspb.Message.getRepeatedWrapperField(this, proto.homeflix.User, 1));
};


/**
 * @param {!Array<!proto.homeflix.User>} value
 * @return {!proto.homeflix.GetAllUsersResponse} returns this
*/
proto.homeflix.GetAllUsersResponse.prototype.setUsersList = function(value) {
  return jspb.Message.setRepeatedWrapperField(this, 1, value);
};


/**
 * @param {!proto.homeflix.User=} opt_value
 * @param {number=} opt_index
 * @return {!proto.homeflix.User}
 */
proto.homeflix.GetAllUsersResponse.prototype.addUsers = function(opt_value, opt_index) {
  return jspb.Message.addToRepeatedWrapperField(this, 1, opt_value, proto.homeflix.User, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.homeflix.GetAllUsersResponse} returns this
 */
proto.homeflix.GetAllUsersResponse.prototype.clearUsersList = function() {
  return this.setUsersList([]);
};


/**
 * optional int32 total_count = 2;
 * @return {number}
 */
proto.homeflix.GetAllUsersResponse.prototype.getTotalCount = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetAllUsersResponse} returns this
 */
proto.homeflix.GetAllUsersResponse.prototype.setTotalCount = function(value) {
  return jspb.Message.setProto3IntField(this, 2, value);
};


/**
 * optional int32 page = 3;
 * @return {number}
 */
proto.homeflix.GetAllUsersResponse.prototype.getPage = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 3, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetAllUsersResponse} returns this
 */
proto.homeflix.GetAllUsersResponse.prototype.setPage = function(value) {
  return jspb.Message.setProto3IntField(this, 3, value);
};


/**
 * optional int32 limit = 4;
 * @return {number}
 */
proto.homeflix.GetAllUsersResponse.prototype.getLimit = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 4, 0));
};


/**
 * @param {number} value
 * @return {!proto.homeflix.GetAllUsersResponse} returns this
 */
proto.homeflix.GetAllUsersResponse.prototype.setLimit = function(value) {
  return jspb.Message.setProto3IntField(this, 4, value);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.homeflix.DeleteUserRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.homeflix.DeleteUserRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.homeflix.DeleteUserRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.DeleteUserRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    userId: jspb.Message.getFieldWithDefault(msg, 1, "")
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.homeflix.DeleteUserRequest}
 */
proto.homeflix.DeleteUserRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.homeflix.DeleteUserRequest;
  return proto.homeflix.DeleteUserRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.homeflix.DeleteUserRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.homeflix.DeleteUserRequest}
 */
proto.homeflix.DeleteUserRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setUserId(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.homeflix.DeleteUserRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.homeflix.DeleteUserRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.homeflix.DeleteUserRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.homeflix.DeleteUserRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getUserId();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
};


/**
 * optional string user_id = 1;
 * @return {string}
 */
proto.homeflix.DeleteUserRequest.prototype.getUserId = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.homeflix.DeleteUserRequest} returns this
 */
proto.homeflix.DeleteUserRequest.prototype.setUserId = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


goog.object.extend(exports, proto.homeflix);

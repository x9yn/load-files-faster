var Module;

// DEBUG MODE FLAG
const DEBUG_MODE = false;
let a = () => {
  DEBUG_MODE ? console.log("Debug mode enabled!") : null;
};
a();

// silly funny progress bar
function asciiProgressBar(current, total, length = 30) {
  if (total === 0) {
    return "[Error: total is zero]";
  }
  const proportion = current / total;
  const filledLength = Math.round(length * proportion);
  const bar = "#".repeat(filledLength) + "-".repeat(length - filledLength);
  const percent = (proportion * 100).toFixed(1);
  return `[${bar}] ${percent}%`;
}

if (typeof Module === "undefined")
  Module = eval(
    "(function() { try { return Module || {} } catch(e) { return {} } })()"
  );

if (!Module.expectedDataFileDownloads) {
  Module.expectedDataFileDownloads = 0;
  // Module.finishedDataFileDownloads = 0;
}
Module.expectedDataFileDownloads++;
(function () {
  var loadPackage = function (metadata) {
    var PACKAGE_PATH;
    if (typeof window === "object") {
      PACKAGE_PATH = window["encodeURIComponent"](
        window.location.pathname
          .toString()
          .substring(0, window.location.pathname.toString().lastIndexOf("/")) +
          "/"
      );
    } else if (typeof location !== "undefined") {
      // worker
      PACKAGE_PATH = encodeURIComponent(
        location.pathname
          .toString()
          .substring(0, location.pathname.toString().lastIndexOf("/")) + "/"
      );
    } else {
      throw "using preloaded data can only be done on a web page or in a web worker";
    }
    var PACKAGE_NAME = "game.data";
    var REMOTE_PACKAGE_BASE = "game.data";
    if (
      typeof Module["locateFilePackage"] === "function" &&
      !Module["locateFile"]
    ) {
      Module["locateFile"] = Module["locateFilePackage"];
      Module.printErr(
        "warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)"
      );
    }

    // var REMOTE_PACKAGE_NAME =
    //   typeof Module["locateFile"] === "function"
    //     ? Module["locateFile"](REMOTE_PACKAGE_BASE)
    //     : (Module["filePackagePrefixURL"] || "") + REMOTE_PACKAGE_BASE;

    // use file from custom cdn if not in DEBUG_MODE
    var REMOTE_PACKAGE_NAME = DEBUG_MODE
      ? typeof Module["locateFile"] === "function"
        ? Module["locateFile"](REMOTE_PACKAGE_BASE)
        : (Module["filePackagePrefixURL"] || "") + REMOTE_PACKAGE_BASE
      : "https://telatro-cdn.tomcat.sh/game.data";

    var REMOTE_PACKAGE_SIZE = metadata.remote_package_size;
    var PACKAGE_UUID = metadata.package_uuid;

    function fetchRemotePackage(packageName, packageSize, callback, errback) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", packageName, true);
      xhr.responseType = "arraybuffer";
      xhr.onprogress = function (event) {
        var url = packageName;
        var size = packageSize;
        if (event.total) size = event.total;
        if (event.loaded) {
          if (!xhr.addedTotal) {
            xhr.addedTotal = true;
            if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
            Module.dataFileDownloads[url] = {
              loaded: event.loaded,
              total: size,
            };
          } else {
            Module.dataFileDownloads[url].loaded = event.loaded;
          }
          var total = 0;
          var loaded = 0;
          var num = 0;
          for (var download in Module.dataFileDownloads) {
            var data = Module.dataFileDownloads[download];
            total += data.total;
            loaded += data.loaded;
            num++;
          }
          total = Math.ceil((total * Module.expectedDataFileDownloads) / num);
          if (Module["setStatus"])
            Module["setStatus"](
              // "Downloading data... (" + loaded + "/" + total + ")"
              `Downloading data... ${asciiProgressBar(
                loaded,
                total,
                50
              )} (${loaded}B/${total}B)`
            );
        } else if (!Module.dataFileDownloads) {
          if (Module["setStatus"]) Module["setStatus"]("Downloading data...");
        }
      };
      xhr.onerror = function (event) {
        throw new Error("NetworkError for: " + packageName);
      };
      xhr.onload = function (event) {
        if (
          xhr.status == 200 ||
          xhr.status == 304 ||
          xhr.status == 206 ||
          (xhr.status == 0 && xhr.response)
        ) {
          // file URLs can return 0
          var packageData = xhr.response;
          callback(packageData);
        } else {
          throw new Error(xhr.statusText + " : " + xhr.responseURL);
        }
      };
      xhr.send(null);
    }

    function handleError(error) {
      console.error("package error:", error);
    }

    function runWithFS() {
      function assert(check, msg) {
        if (!check) throw msg + new Error().stack;
      }
      Module["FS_createPath"]("/", "engine", true, true);
      Module["FS_createPath"]("/", "functions", true, true);
      Module["FS_createPath"]("/", "localization", true, true);
      Module["FS_createPath"]("/", "resources", true, true);
      Module["FS_createPath"]("/resources", "fonts", true, true);
      Module["FS_createPath"]("/resources", "shaders", true, true);
      Module["FS_createPath"]("/resources", "sounds", true, true);
      Module["FS_createPath"]("/resources", "textures", true, true);
      Module["FS_createPath"]("/resources/textures", "1x", true, true);
      Module["FS_createPath"]("/resources/textures/1x", "collabs", true, true);
      Module["FS_createPath"]("/resources/textures", "2x", true, true);
      Module["FS_createPath"]("/resources/textures/2x", "collabs", true, true);

      function DataRequest(start, end, crunched, audio) {
        this.start = start;
        this.end = end;
        this.crunched = crunched;
        this.audio = audio;
      }
      DataRequest.prototype = {
        requests: {},
        open: function (mode, name) {
          this.name = name;
          this.requests[name] = this;
          Module["addRunDependency"]("fp " + this.name);
        },
        send: function () {},
        onload: function () {
          var byteArray = this.byteArray.subarray(this.start, this.end);

          this.finish(byteArray);
        },
        finish: function (byteArray) {
          var that = this;

          Module["FS_createDataFile"](
            this.name,
            null,
            byteArray,
            true,
            true,
            true
          ); // canOwn this data in the filesystem, it is a slide into the heap that will never change
          Module["removeRunDependency"]("fp " + that.name);

          this.requests[this.name] = null;
        },
      };

      var files = metadata.files;
      for (i = 0; i < files.length; ++i) {
        new DataRequest(
          files[i].start,
          files[i].end,
          files[i].crunched,
          files[i].audio
        ).open("GET", files[i].filename);
      }

      var indexedDB =
        window.indexedDB ||
        window.mozIndexedDB ||
        window.webkitIndexedDB ||
        window.msIndexedDB;
      var IDB_RO = "readonly";
      var IDB_RW = "readwrite";
      var DB_NAME = "EM_PRELOAD_CACHE";
      var DB_VERSION = 1;
      var METADATA_STORE_NAME = "METADATA";
      var PACKAGE_STORE_NAME = "PACKAGES";
      function openDatabase(callback, errback) {
        try {
          var openRequest = indexedDB.open(DB_NAME, DB_VERSION);
        } catch (e) {
          return errback(e);
        }
        openRequest.onupgradeneeded = function (event) {
          var db = event.target.result;

          if (db.objectStoreNames.contains(PACKAGE_STORE_NAME)) {
            db.deleteObjectStore(PACKAGE_STORE_NAME);
          }
          var packages = db.createObjectStore(PACKAGE_STORE_NAME);

          if (db.objectStoreNames.contains(METADATA_STORE_NAME)) {
            db.deleteObjectStore(METADATA_STORE_NAME);
          }
          var metadata = db.createObjectStore(METADATA_STORE_NAME);
        };
        openRequest.onsuccess = function (event) {
          var db = event.target.result;
          callback(db);
        };
        openRequest.onerror = function (error) {
          errback(error);
        };
      }

      /* Check if there's a cached package, and if so whether it's the latest available */
      function checkCachedPackage(db, packageName, callback, errback) {
        var transaction = db.transaction([METADATA_STORE_NAME], IDB_RO);
        var metadata = transaction.objectStore(METADATA_STORE_NAME);

        var getRequest = metadata.get("metadata/" + packageName);
        getRequest.onsuccess = function (event) {
          var result = event.target.result;
          if (!result) {
            return callback(false);
          } else {
            return callback(PACKAGE_UUID === result.uuid);
          }
        };
        getRequest.onerror = function (error) {
          errback(error);
        };
      }

      function fetchCachedPackage(db, packageName, callback, errback) {
        var transaction = db.transaction([PACKAGE_STORE_NAME], IDB_RO);
        var packages = transaction.objectStore(PACKAGE_STORE_NAME);

        var getRequest = packages.get("package/" + packageName);
        getRequest.onsuccess = function (event) {
          var result = event.target.result;
          callback(result);
        };
        getRequest.onerror = function (error) {
          errback(error);
        };
      }

      function cacheRemotePackage(
        db,
        packageName,
        packageData,
        packageMeta,
        callback,
        errback
      ) {
        var transaction_packages = db.transaction([PACKAGE_STORE_NAME], IDB_RW);
        var packages = transaction_packages.objectStore(PACKAGE_STORE_NAME);

        var putPackageRequest = packages.put(
          packageData,
          "package/" + packageName
        );
        putPackageRequest.onsuccess = function (event) {
          var transaction_metadata = db.transaction(
            [METADATA_STORE_NAME],
            IDB_RW
          );
          var metadata = transaction_metadata.objectStore(METADATA_STORE_NAME);
          var putMetadataRequest = metadata.put(
            packageMeta,
            "metadata/" + packageName
          );
          putMetadataRequest.onsuccess = function (event) {
            callback(packageData);
          };
          putMetadataRequest.onerror = function (error) {
            errback(error);
          };
        };
        putPackageRequest.onerror = function (error) {
          errback(error);
        };
      }

      function processPackageData(arrayBuffer) {
        Module.finishedDataFileDownloads++;
        assert(arrayBuffer, "Loading data file failed.");
        assert(
          arrayBuffer instanceof ArrayBuffer,
          "bad input to processPackageData"
        );
        var byteArray = new Uint8Array(arrayBuffer);
        var curr;

        // copy the entire loaded file into a spot in the heap. Files will refer to slices in that. They cannot be freed though
        // (we may be allocating before malloc is ready, during startup).
        if (Module["SPLIT_MEMORY"])
          Module.printErr(
            "warning: you should run the file packager with --no-heap-copy when SPLIT_MEMORY is used, otherwise copying into the heap may fail due to the splitting"
          );
        var ptr = Module["getMemory"](byteArray.length);
        Module["HEAPU8"].set(byteArray, ptr);
        DataRequest.prototype.byteArray = Module["HEAPU8"].subarray(
          ptr,
          ptr + byteArray.length
        );

        var files = metadata.files;
        for (i = 0; i < files.length; ++i) {
          DataRequest.prototype.requests[files[i].filename].onload();
        }
        Module["removeRunDependency"]("datafile_game.data");
      }
      Module["addRunDependency"]("datafile_game.data");

      if (!Module.preloadResults) Module.preloadResults = {};

      function preloadFallback(error) {
        console.error(error);
        console.error("falling back to default preload behavior");
        fetchRemotePackage(
          REMOTE_PACKAGE_NAME,
          REMOTE_PACKAGE_SIZE,
          processPackageData,
          handleError
        );
      }

      openDatabase(function (db) {
        checkCachedPackage(
          db,
          PACKAGE_PATH + PACKAGE_NAME,
          function (useCached) {
            Module.preloadResults[PACKAGE_NAME] = { fromCache: useCached };
            if (useCached && !DEBUG_MODE) {
              // disabled cached stuff when in debug mode
              console.info("loading " + PACKAGE_NAME + " from cache");
              fetchCachedPackage(
                db,
                PACKAGE_PATH + PACKAGE_NAME,
                processPackageData,
                preloadFallback
              );
            } else {
              console.info("loading " + PACKAGE_NAME + " from remote");
              fetchRemotePackage(
                REMOTE_PACKAGE_NAME,
                REMOTE_PACKAGE_SIZE,
                function (packageData) {
                  cacheRemotePackage(
                    db,
                    PACKAGE_PATH + PACKAGE_NAME,
                    packageData,
                    { uuid: PACKAGE_UUID },
                    processPackageData,
                    function (error) {
                      console.error(error);
                      processPackageData(packageData);
                    }
                  );
                },
                preloadFallback
              );
            }
          },
          preloadFallback
        );
      }, preloadFallback);

      if (Module["setStatus"]) Module["setStatus"]("Downloading...");
    }
    if (Module["calledRun"]) {
      runWithFS();
    } else {
      if (!Module["preRun"]) Module["preRun"] = [];
      Module["preRun"].push(runWithFS); // FS is not initialized yet, wait for it
    }
  };
  // ignore placeholder (and error) its needed so that it doesnt crash after updating the lua code (gets replaced by setup_loadPackage.py in build.sh)
  loadPackage({"package_uuid":"76de2798-74b4-4e91-aab0-e0f725d005a1","remote_package_size":92944291,"files":[{"filename":"/back.lua","crunched":0,"start":0,"end":12555,"audio":false},{"filename":"/blind.lua","crunched":0,"start":12555,"end":40089,"audio":false},{"filename":"/card.lua","crunched":0,"start":40089,"end":282640,"audio":false},{"filename":"/card_character.lua","crunched":0,"start":282640,"end":287998,"audio":false},{"filename":"/cardarea.lua","crunched":0,"start":287998,"end":320080,"audio":false},{"filename":"/challenges.lua","crunched":0,"start":320080,"end":344012,"audio":false},{"filename":"/conf.lua","crunched":0,"start":344012,"end":344296,"audio":false},{"filename":"/engine/animatedsprite.lua","crunched":0,"start":344296,"end":347568,"audio":false},{"filename":"/engine/controller.lua","crunched":0,"start":347568,"end":408222,"audio":false},{"filename":"/engine/event.lua","crunched":0,"start":408222,"end":415256,"audio":false},{"filename":"/engine/http_manager.lua","crunched":0,"start":415256,"end":415926,"audio":false},{"filename":"/engine/moveable.lua","crunched":0,"start":415926,"end":436457,"audio":false},{"filename":"/engine/node.lua","crunched":0,"start":436457,"end":452174,"audio":false},{"filename":"/engine/object.lua","crunched":0,"start":452174,"end":452840,"audio":false},{"filename":"/engine/particles.lua","crunched":0,"start":452840,"end":459435,"audio":false},{"filename":"/engine/profile.lua","crunched":0,"start":459435,"end":464008,"audio":false},{"filename":"/engine/save_manager.lua","crunched":0,"start":464008,"end":467802,"audio":false},{"filename":"/engine/sound_manager.lua","crunched":0,"start":467802,"end":474730,"audio":false},{"filename":"/engine/sprite.lua","crunched":0,"start":474730,"end":482696,"audio":false},{"filename":"/engine/string_packer.lua","crunched":0,"start":482696,"end":485476,"audio":false},{"filename":"/engine/text.lua","crunched":0,"start":485476,"end":500432,"audio":false},{"filename":"/engine/ui.lua","crunched":0,"start":500432,"end":545729,"audio":false},{"filename":"/functions/UI_definitions.lua","crunched":0,"start":545729,"end":897972,"audio":false},{"filename":"/functions/button_callbacks.lua","crunched":0,"start":897972,"end":1015462,"audio":false},{"filename":"/functions/common_events.lua","crunched":0,"start":1015462,"end":1146616,"audio":false},{"filename":"/functions/misc_functions.lua","crunched":0,"start":1146616,"end":1220488,"audio":false},{"filename":"/functions/state_events.lua","crunched":0,"start":1220488,"end":1296644,"audio":false},{"filename":"/functions/test_functions.lua","crunched":0,"start":1296644,"end":1304793,"audio":false},{"filename":"/game.lua","crunched":0,"start":1304793,"end":1542914,"audio":false},{"filename":"/globals.lua","crunched":0,"start":1542914,"end":1559611,"audio":false},{"filename":"/localization/de.lua","crunched":0,"start":1559611,"end":1714292,"audio":false},{"filename":"/localization/en-us.lua","crunched":0,"start":1714292,"end":1861099,"audio":false},{"filename":"/localization/es_419.lua","crunched":0,"start":1861099,"end":2014661,"audio":false},{"filename":"/localization/es_ES.lua","crunched":0,"start":2014661,"end":2168331,"audio":false},{"filename":"/localization/fr.lua","crunched":0,"start":2168331,"end":2325881,"audio":false},{"filename":"/localization/id.lua","crunched":0,"start":2325881,"end":2477538,"audio":false},{"filename":"/localization/it.lua","crunched":0,"start":2477538,"end":2629404,"audio":false},{"filename":"/localization/ja.lua","crunched":0,"start":2629404,"end":2797801,"audio":false},{"filename":"/localization/ko.lua","crunched":0,"start":2797801,"end":2957874,"audio":false},{"filename":"/localization/nl.lua","crunched":0,"start":2957874,"end":3110645,"audio":false},{"filename":"/localization/pl.lua","crunched":0,"start":3110645,"end":3265531,"audio":false},{"filename":"/localization/pt_BR.lua","crunched":0,"start":3265531,"end":3418913,"audio":false},{"filename":"/localization/ru.lua","crunched":0,"start":3418913,"end":3600784,"audio":false},{"filename":"/localization/zh_CN.lua","crunched":0,"start":3600784,"end":3748191,"audio":false},{"filename":"/localization/zh_TW.lua","crunched":0,"start":3748191,"end":3895233,"audio":false},{"filename":"/main.lua","crunched":0,"start":3895233,"end":3907327,"audio":false},{"filename":"/resources/.DS_Store","crunched":0,"start":3907327,"end":3913475,"audio":false},{"filename":"/resources/fonts/GoNotoCJKCore.ttf","crunched":0,"start":3913475,"end":22413447,"audio":false},{"filename":"/resources/fonts/GoNotoCurrent-Bold.ttf","crunched":0,"start":22413447,"end":36947491,"audio":false},{"filename":"/resources/fonts/NotoSans-Bold.ttf","crunched":0,"start":36947491,"end":37530095,"audio":false},{"filename":"/resources/fonts/NotoSansJP-Bold.ttf","crunched":0,"start":37530095,"end":43257923,"audio":false},{"filename":"/resources/fonts/NotoSansKR-Bold.ttf","crunched":0,"start":43257923,"end":49448747,"audio":false},{"filename":"/resources/fonts/NotoSansSC-Bold.ttf","crunched":0,"start":49448747,"end":59998863,"audio":false},{"filename":"/resources/fonts/NotoSansTC-Bold.ttf","crunched":0,"start":59998863,"end":67104175,"audio":false},{"filename":"/resources/fonts/m6x11plus.ttf","crunched":0,"start":67104175,"end":67139240,"audio":false},{"filename":"/resources/gamecontrollerdb.txt","crunched":0,"start":67139240,"end":67537064,"audio":false},{"filename":"/resources/shaders/CRT.fs","crunched":0,"start":67537064,"end":67544334,"audio":false},{"filename":"/resources/shaders/background.fs","crunched":0,"start":67544334,"end":67546854,"audio":false},{"filename":"/resources/shaders/booster.fs","crunched":0,"start":67546854,"end":67552177,"audio":false},{"filename":"/resources/shaders/debuff.fs","crunched":0,"start":67552177,"end":67557341,"audio":false},{"filename":"/resources/shaders/dissolve.fs","crunched":0,"start":67557341,"end":67561610,"audio":false},{"filename":"/resources/shaders/flame.fs","crunched":0,"start":67561610,"end":67564459,"audio":false},{"filename":"/resources/shaders/flash.fs","crunched":0,"start":67564459,"end":67565360,"audio":false},{"filename":"/resources/shaders/foil.fs","crunched":0,"start":67565360,"end":67571295,"audio":false},{"filename":"/resources/shaders/gold_seal.fs","crunched":0,"start":67571295,"end":67572096,"audio":false},{"filename":"/resources/shaders/holo.fs","crunched":0,"start":67572096,"end":67578103,"audio":false},{"filename":"/resources/shaders/hologram.fs","crunched":0,"start":67578103,"end":67583865,"audio":false},{"filename":"/resources/shaders/negative.fs","crunched":0,"start":67583865,"end":67588759,"audio":false},{"filename":"/resources/shaders/negative_shine.fs","crunched":0,"start":67588759,"end":67593669,"audio":false},{"filename":"/resources/shaders/played.fs","crunched":0,"start":67593669,"end":67598459,"audio":false},{"filename":"/resources/shaders/polychrome.fs","crunched":0,"start":67598459,"end":67604285,"audio":false},{"filename":"/resources/shaders/skew.fs","crunched":0,"start":67604285,"end":67604956,"audio":false},{"filename":"/resources/shaders/splash.fs","crunched":0,"start":67604956,"end":67607563,"audio":false},{"filename":"/resources/shaders/vortex.fs","crunched":0,"start":67607563,"end":67608374,"audio":false},{"filename":"/resources/shaders/voucher.fs","crunched":0,"start":67608374,"end":67613203,"audio":false},{"filename":"/resources/sounds/ambientFire1.ogg","crunched":0,"start":67613203,"end":68091534,"audio":true},{"filename":"/resources/sounds/ambientFire2.ogg","crunched":0,"start":68091534,"end":68600031,"audio":true},{"filename":"/resources/sounds/ambientFire3.ogg","crunched":0,"start":68600031,"end":69103588,"audio":true},{"filename":"/resources/sounds/ambientOrgan1.ogg","crunched":0,"start":69103588,"end":69484541,"audio":true},{"filename":"/resources/sounds/button.ogg","crunched":0,"start":69484541,"end":69492674,"audio":true},{"filename":"/resources/sounds/cancel.ogg","crunched":0,"start":69492674,"end":69502754,"audio":true},{"filename":"/resources/sounds/card1.ogg","crunched":0,"start":69502754,"end":69516692,"audio":true},{"filename":"/resources/sounds/card3.ogg","crunched":0,"start":69516692,"end":69528564,"audio":true},{"filename":"/resources/sounds/cardFan2.ogg","crunched":0,"start":69528564,"end":69545033,"audio":true},{"filename":"/resources/sounds/cardSlide1.ogg","crunched":0,"start":69545033,"end":69555961,"audio":true},{"filename":"/resources/sounds/cardSlide2.ogg","crunched":0,"start":69555961,"end":69565844,"audio":true},{"filename":"/resources/sounds/chips1.ogg","crunched":0,"start":69565844,"end":69574828,"audio":true},{"filename":"/resources/sounds/chips2.ogg","crunched":0,"start":69574828,"end":69586945,"audio":true},{"filename":"/resources/sounds/coin1.ogg","crunched":0,"start":69586945,"end":69598254,"audio":true},{"filename":"/resources/sounds/coin2.ogg","crunched":0,"start":69598254,"end":69607980,"audio":true},{"filename":"/resources/sounds/coin3.ogg","crunched":0,"start":69607980,"end":69619643,"audio":true},{"filename":"/resources/sounds/coin4.ogg","crunched":0,"start":69619643,"end":69630168,"audio":true},{"filename":"/resources/sounds/coin5.ogg","crunched":0,"start":69630168,"end":69643270,"audio":true},{"filename":"/resources/sounds/coin6.ogg","crunched":0,"start":69643270,"end":69661321,"audio":true},{"filename":"/resources/sounds/coin7.ogg","crunched":0,"start":69661321,"end":69672636,"audio":true},{"filename":"/resources/sounds/crumple1.ogg","crunched":0,"start":69672636,"end":69686820,"audio":true},{"filename":"/resources/sounds/crumple2.ogg","crunched":0,"start":69686820,"end":69701156,"audio":true},{"filename":"/resources/sounds/crumple3.ogg","crunched":0,"start":69701156,"end":69714440,"audio":true},{"filename":"/resources/sounds/crumple4.ogg","crunched":0,"start":69714440,"end":69727572,"audio":true},{"filename":"/resources/sounds/crumple5.ogg","crunched":0,"start":69727572,"end":69741378,"audio":true},{"filename":"/resources/sounds/crumpleLong1.ogg","crunched":0,"start":69741378,"end":69792516,"audio":true},{"filename":"/resources/sounds/crumpleLong2.ogg","crunched":0,"start":69792516,"end":69847258,"audio":true},{"filename":"/resources/sounds/explosion1.ogg","crunched":0,"start":69847258,"end":69895684,"audio":true},{"filename":"/resources/sounds/explosion_buildup1.ogg","crunched":0,"start":69895684,"end":69927535,"audio":true},{"filename":"/resources/sounds/explosion_release1.ogg","crunched":0,"start":69927535,"end":69959533,"audio":true},{"filename":"/resources/sounds/foil1.ogg","crunched":0,"start":69959533,"end":69968299,"audio":true},{"filename":"/resources/sounds/foil2.ogg","crunched":0,"start":69968299,"end":69977841,"audio":true},{"filename":"/resources/sounds/generic1.ogg","crunched":0,"start":69977841,"end":69984976,"audio":true},{"filename":"/resources/sounds/glass1.ogg","crunched":0,"start":69984976,"end":70001930,"audio":true},{"filename":"/resources/sounds/glass2.ogg","crunched":0,"start":70001930,"end":70018727,"audio":true},{"filename":"/resources/sounds/glass3.ogg","crunched":0,"start":70018727,"end":70035299,"audio":true},{"filename":"/resources/sounds/glass4.ogg","crunched":0,"start":70035299,"end":70052803,"audio":true},{"filename":"/resources/sounds/glass5.ogg","crunched":0,"start":70052803,"end":70069938,"audio":true},{"filename":"/resources/sounds/glass6.ogg","crunched":0,"start":70069938,"end":70087983,"audio":true},{"filename":"/resources/sounds/gold_seal.ogg","crunched":0,"start":70087983,"end":70101267,"audio":true},{"filename":"/resources/sounds/gong.ogg","crunched":0,"start":70101267,"end":70119412,"audio":true},{"filename":"/resources/sounds/highlight1.ogg","crunched":0,"start":70119412,"end":70126599,"audio":true},{"filename":"/resources/sounds/highlight2.ogg","crunched":0,"start":70126599,"end":70139983,"audio":true},{"filename":"/resources/sounds/holo1.ogg","crunched":0,"start":70139983,"end":70152538,"audio":true},{"filename":"/resources/sounds/introPad1.ogg","crunched":0,"start":70152538,"end":70486556,"audio":true},{"filename":"/resources/sounds/magic_crumple.ogg","crunched":0,"start":70486556,"end":70572685,"audio":true},{"filename":"/resources/sounds/magic_crumple2.ogg","crunched":0,"start":70572685,"end":70608015,"audio":true},{"filename":"/resources/sounds/magic_crumple3.ogg","crunched":0,"start":70608015,"end":70632445,"audio":true},{"filename":"/resources/sounds/multhit1.ogg","crunched":0,"start":70632445,"end":70644527,"audio":true},{"filename":"/resources/sounds/multhit2.ogg","crunched":0,"start":70644527,"end":70659479,"audio":true},{"filename":"/resources/sounds/music1.ogg","crunched":0,"start":70659479,"end":73598221,"audio":true},{"filename":"/resources/sounds/music2.ogg","crunched":0,"start":73598221,"end":76213490,"audio":true},{"filename":"/resources/sounds/music3.ogg","crunched":0,"start":76213490,"end":78724548,"audio":true},{"filename":"/resources/sounds/music4.ogg","crunched":0,"start":78724548,"end":81532945,"audio":true},{"filename":"/resources/sounds/music5.ogg","crunched":0,"start":81532945,"end":84378773,"audio":true},{"filename":"/resources/sounds/negative.ogg","crunched":0,"start":84378773,"end":84391971,"audio":true},{"filename":"/resources/sounds/other1.ogg","crunched":0,"start":84391971,"end":84404119,"audio":true},{"filename":"/resources/sounds/paper1.ogg","crunched":0,"start":84404119,"end":84409391,"audio":true},{"filename":"/resources/sounds/polychrome1.ogg","crunched":0,"start":84409391,"end":84439412,"audio":true},{"filename":"/resources/sounds/slice1.ogg","crunched":0,"start":84439412,"end":84447909,"audio":true},{"filename":"/resources/sounds/splash_buildup.ogg","crunched":0,"start":84447909,"end":84787468,"audio":true},{"filename":"/resources/sounds/tarot1.ogg","crunched":0,"start":84787468,"end":84796589,"audio":true},{"filename":"/resources/sounds/tarot2.ogg","crunched":0,"start":84796589,"end":84807411,"audio":true},{"filename":"/resources/sounds/timpani.ogg","crunched":0,"start":84807411,"end":84821602,"audio":true},{"filename":"/resources/sounds/voice1.ogg","crunched":0,"start":84821602,"end":84828686,"audio":true},{"filename":"/resources/sounds/voice10.ogg","crunched":0,"start":84828686,"end":84835777,"audio":true},{"filename":"/resources/sounds/voice11.ogg","crunched":0,"start":84835777,"end":84842766,"audio":true},{"filename":"/resources/sounds/voice2.ogg","crunched":0,"start":84842766,"end":84849786,"audio":true},{"filename":"/resources/sounds/voice3.ogg","crunched":0,"start":84849786,"end":84856885,"audio":true},{"filename":"/resources/sounds/voice4.ogg","crunched":0,"start":84856885,"end":84864248,"audio":true},{"filename":"/resources/sounds/voice5.ogg","crunched":0,"start":84864248,"end":84871443,"audio":true},{"filename":"/resources/sounds/voice6.ogg","crunched":0,"start":84871443,"end":84878562,"audio":true},{"filename":"/resources/sounds/voice7.ogg","crunched":0,"start":84878562,"end":84885623,"audio":true},{"filename":"/resources/sounds/voice8.ogg","crunched":0,"start":84885623,"end":84892787,"audio":true},{"filename":"/resources/sounds/voice9.ogg","crunched":0,"start":84892787,"end":84899953,"audio":true},{"filename":"/resources/sounds/whoosh.ogg","crunched":0,"start":84899953,"end":84909865,"audio":true},{"filename":"/resources/sounds/whoosh1.ogg","crunched":0,"start":84909865,"end":84922767,"audio":true},{"filename":"/resources/sounds/whoosh2.ogg","crunched":0,"start":84922767,"end":84935615,"audio":true},{"filename":"/resources/sounds/whoosh_long.ogg","crunched":0,"start":84935615,"end":85049796,"audio":true},{"filename":"/resources/sounds/win.ogg","crunched":0,"start":85049796,"end":85086362,"audio":true},{"filename":"/resources/textures/1x/8BitDeck.png","crunched":0,"start":85086362,"end":85147501,"audio":false},{"filename":"/resources/textures/1x/8BitDeck_opt2.png","crunched":0,"start":85147501,"end":85220036,"audio":false},{"filename":"/resources/textures/1x/BlindChips.png","crunched":0,"start":85220036,"end":85399911,"audio":false},{"filename":"/resources/textures/1x/Enhancers.png","crunched":0,"start":85399911,"end":85479262,"audio":false},{"filename":"/resources/textures/1x/Jokers.png","crunched":0,"start":85479262,"end":86144513,"audio":false},{"filename":"/resources/textures/1x/ShopSignAnimation.png","crunched":0,"start":86144513,"end":86158669,"audio":false},{"filename":"/resources/textures/1x/Tarots.png","crunched":0,"start":86158669,"end":86290341,"audio":false},{"filename":"/resources/textures/1x/Vouchers.png","crunched":0,"start":86290341,"end":86384085,"audio":false},{"filename":"/resources/textures/1x/balatro.png","crunched":0,"start":86384085,"end":86427623,"audio":false},{"filename":"/resources/textures/1x/balatro_alt.png","crunched":0,"start":86427623,"end":86462443,"audio":false},{"filename":"/resources/textures/1x/boosters.png","crunched":0,"start":86462443,"end":86662240,"audio":false},{"filename":"/resources/textures/1x/chips.png","crunched":0,"start":86662240,"end":86669479,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AC_1.png","crunched":0,"start":86669479,"end":86678307,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AC_2.png","crunched":0,"start":86678307,"end":86687133,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AU_1.png","crunched":0,"start":86687133,"end":86694492,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_AU_2.png","crunched":0,"start":86694492,"end":86703630,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_BUG_1.png","crunched":0,"start":86703630,"end":86713962,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_BUG_2.png","crunched":0,"start":86713962,"end":86725527,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_C7_1.png","crunched":0,"start":86725527,"end":86734829,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_C7_2.png","crunched":0,"start":86734829,"end":86744107,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CL_1.png","crunched":0,"start":86744107,"end":86753427,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CL_2.png","crunched":0,"start":86753427,"end":86762215,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CR_1.png","crunched":0,"start":86762215,"end":86770949,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CR_2.png","crunched":0,"start":86770949,"end":86780358,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CYP_1.png","crunched":0,"start":86780358,"end":86789117,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_CYP_2.png","crunched":0,"start":86789117,"end":86797894,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_D2_1.png","crunched":0,"start":86797894,"end":86806623,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_D2_2.png","crunched":0,"start":86806623,"end":86815407,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DBD_1.png","crunched":0,"start":86815407,"end":86824533,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DBD_2.png","crunched":0,"start":86824533,"end":86833905,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DS_1.png","crunched":0,"start":86833905,"end":86841800,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DS_2.png","crunched":0,"start":86841800,"end":86849720,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DTD_1.png","crunched":0,"start":86849720,"end":86857750,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_DTD_2.png","crunched":0,"start":86857750,"end":86865882,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_EG_1.png","crunched":0,"start":86865882,"end":86871725,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_EG_2.png","crunched":0,"start":86871725,"end":86877815,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_FO_1.png","crunched":0,"start":86877815,"end":86887141,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_FO_2.png","crunched":0,"start":86887141,"end":86896782,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_PC_1.png","crunched":0,"start":86896782,"end":86904934,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_PC_2.png","crunched":0,"start":86904934,"end":86913406,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_R_1.png","crunched":0,"start":86913406,"end":86924773,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_R_2.png","crunched":0,"start":86924773,"end":86936759,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SK_1.png","crunched":0,"start":86936759,"end":86947224,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SK_2.png","crunched":0,"start":86947224,"end":86957571,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STP_1.png","crunched":0,"start":86957571,"end":86966176,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STP_2.png","crunched":0,"start":86966176,"end":86974785,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STS_1.png","crunched":0,"start":86974785,"end":86984244,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_STS_2.png","crunched":0,"start":86984244,"end":86994415,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SV_1.png","crunched":0,"start":86994415,"end":87004029,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_SV_2.png","crunched":0,"start":87004029,"end":87014276,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TBoI_1.png","crunched":0,"start":87014276,"end":87022354,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TBoI_2.png","crunched":0,"start":87022354,"end":87030093,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TW_1.png","crunched":0,"start":87030093,"end":87039302,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_TW_2.png","crunched":0,"start":87039302,"end":87048387,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_VS_1.png","crunched":0,"start":87048387,"end":87055849,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_VS_2.png","crunched":0,"start":87055849,"end":87065001,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_WF_1.png","crunched":0,"start":87065001,"end":87073609,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_WF_2.png","crunched":0,"start":87073609,"end":87083757,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_XR_1.png","crunched":0,"start":87083757,"end":87093566,"audio":false},{"filename":"/resources/textures/1x/collabs/collab_XR_2.png","crunched":0,"start":87093566,"end":87103306,"audio":false},{"filename":"/resources/textures/1x/gamepad_ui.png","crunched":0,"start":87103306,"end":87144423,"audio":false},{"filename":"/resources/textures/1x/icons.png","crunched":0,"start":87144423,"end":87157935,"audio":false},{"filename":"/resources/textures/1x/localthunk-logo.png","crunched":0,"start":87157935,"end":87315755,"audio":false},{"filename":"/resources/textures/1x/playstack-logo.png","crunched":0,"start":87315755,"end":87489542,"audio":false},{"filename":"/resources/textures/1x/stickers.png","crunched":0,"start":87489542,"end":87499017,"audio":false},{"filename":"/resources/textures/1x/tags.png","crunched":0,"start":87499017,"end":87509810,"audio":false},{"filename":"/resources/textures/1x/ui_assets.png","crunched":0,"start":87509810,"end":87511405,"audio":false},{"filename":"/resources/textures/1x/ui_assets_opt2.png","crunched":0,"start":87511405,"end":87512985,"audio":false},{"filename":"/resources/textures/2x/8BitDeck.png","crunched":0,"start":87512985,"end":87673123,"audio":false},{"filename":"/resources/textures/2x/8BitDeck_opt2.png","crunched":0,"start":87673123,"end":87842784,"audio":false},{"filename":"/resources/textures/2x/BlindChips.png","crunched":0,"start":87842784,"end":88345950,"audio":false},{"filename":"/resources/textures/2x/Enhancers.png","crunched":0,"start":88345950,"end":88492992,"audio":false},{"filename":"/resources/textures/2x/Jokers.png","crunched":0,"start":88492992,"end":89884106,"audio":false},{"filename":"/resources/textures/2x/ShopSignAnimation.png","crunched":0,"start":89884106,"end":89919925,"audio":false},{"filename":"/resources/textures/2x/Tarots.png","crunched":0,"start":89919925,"end":90205232,"audio":false},{"filename":"/resources/textures/2x/Vouchers.png","crunched":0,"start":90205232,"end":90421236,"audio":false},{"filename":"/resources/textures/2x/balatro.png","crunched":0,"start":90421236,"end":90499051,"audio":false},{"filename":"/resources/textures/2x/balatro_alt.png","crunched":0,"start":90499051,"end":90565957,"audio":false},{"filename":"/resources/textures/2x/boosters.png","crunched":0,"start":90565957,"end":90901156,"audio":false},{"filename":"/resources/textures/2x/chips.png","crunched":0,"start":90901156,"end":90914822,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AC_1.png","crunched":0,"start":90914822,"end":90932137,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AC_2.png","crunched":0,"start":90932137,"end":90949489,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AU_1.png","crunched":0,"start":90949489,"end":90965181,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_AU_2.png","crunched":0,"start":90965181,"end":90982338,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_BUG_1.png","crunched":0,"start":90982338,"end":91001312,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_BUG_2.png","crunched":0,"start":91001312,"end":91021473,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_C7_1.png","crunched":0,"start":91021473,"end":91038922,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_C7_2.png","crunched":0,"start":91038922,"end":91056660,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CL_1.png","crunched":0,"start":91056660,"end":91074580,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CL_2.png","crunched":0,"start":91074580,"end":91091611,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CR_1.png","crunched":0,"start":91091611,"end":91108468,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CR_2.png","crunched":0,"start":91108468,"end":91125919,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CYP_1.png","crunched":0,"start":91125919,"end":91143825,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_CYP_2.png","crunched":0,"start":91143825,"end":91161674,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_D2_1.png","crunched":0,"start":91161674,"end":91178578,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_D2_2.png","crunched":0,"start":91178578,"end":91195536,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DBD_1.png","crunched":0,"start":91195536,"end":91213137,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DBD_2.png","crunched":0,"start":91213137,"end":91230943,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DS_1.png","crunched":0,"start":91230943,"end":91247558,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DS_2.png","crunched":0,"start":91247558,"end":91264200,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DTD_1.png","crunched":0,"start":91264200,"end":91279815,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_DTD_2.png","crunched":0,"start":91279815,"end":91295587,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_EG_1.png","crunched":0,"start":91295587,"end":91309078,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_EG_2.png","crunched":0,"start":91309078,"end":91322916,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_FO_1.png","crunched":0,"start":91322916,"end":91340815,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_FO_2.png","crunched":0,"start":91340815,"end":91359153,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_PC_1.png","crunched":0,"start":91359153,"end":91376173,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_PC_2.png","crunched":0,"start":91376173,"end":91393216,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_R_1.png","crunched":0,"start":91393216,"end":91413824,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_R_2.png","crunched":0,"start":91413824,"end":91435636,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SK_1.png","crunched":0,"start":91435636,"end":91455250,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SK_2.png","crunched":0,"start":91455250,"end":91473920,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STP_1.png","crunched":0,"start":91473920,"end":91490879,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STP_2.png","crunched":0,"start":91490879,"end":91507876,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STS_1.png","crunched":0,"start":91507876,"end":91525930,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_STS_2.png","crunched":0,"start":91525930,"end":91545218,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SV_1.png","crunched":0,"start":91545218,"end":91562850,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_SV_2.png","crunched":0,"start":91562850,"end":91581122,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TBoI_1.png","crunched":0,"start":91581122,"end":91597528,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TBoI_2.png","crunched":0,"start":91597528,"end":91613912,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TW_1.png","crunched":0,"start":91613912,"end":91631124,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_TW_2.png","crunched":0,"start":91631124,"end":91648316,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_VS_1.png","crunched":0,"start":91648316,"end":91663855,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_VS_2.png","crunched":0,"start":91663855,"end":91681077,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_WF_1.png","crunched":0,"start":91681077,"end":91698612,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_WF_2.png","crunched":0,"start":91698612,"end":91717555,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_XR_1.png","crunched":0,"start":91717555,"end":91736193,"audio":false},{"filename":"/resources/textures/2x/collabs/collab_XR_2.png","crunched":0,"start":91736193,"end":91753911,"audio":false},{"filename":"/resources/textures/2x/gamepad_ui.png","crunched":0,"start":91753911,"end":91871730,"audio":false},{"filename":"/resources/textures/2x/icons.png","crunched":0,"start":91871730,"end":91904003,"audio":false},{"filename":"/resources/textures/2x/localthunk-logo.png","crunched":0,"start":91904003,"end":92404753,"audio":false},{"filename":"/resources/textures/2x/playstack-logo.png","crunched":0,"start":92404753,"end":92863337,"audio":false},{"filename":"/resources/textures/2x/stickers.png","crunched":0,"start":92863337,"end":92891295,"audio":false},{"filename":"/resources/textures/2x/tags.png","crunched":0,"start":92891295,"end":92911768,"audio":false},{"filename":"/resources/textures/2x/ui_assets.png","crunched":0,"start":92911768,"end":92915203,"audio":false},{"filename":"/resources/textures/2x/ui_assets_opt2.png","crunched":0,"start":92915203,"end":92918638,"audio":false},{"filename":"/resources/textures/README.txt","crunched":0,"start":92918638,"end":92919067,"audio":false},{"filename":"/tag.lua","crunched":0,"start":92919067,"end":92944206,"audio":false},{"filename":"/version.jkr","crunched":0,"start":92944206,"end":92944291,"audio":false}]});
})();

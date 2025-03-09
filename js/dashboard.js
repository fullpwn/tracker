(function initDashboard(trackerConfig) {
  const queuestats_frame = document.getElementById('queuestats');
  const sorter = natsort();
  let redraw_timer = null;
  const redraw_interval = 500;
  const redraw_enqueue = () => {
    if (redraw_timer !== null) {
      return;
    }
    redraw_timer = setTimeout(() => {
      redraw_timer = null;
    }, redraw_interval);
  };
  function DifferenceSeries(periodDuration, unitDuration) {
    this.periodDuration = periodDuration;
    this.unitDuration = unitDuration;
    this.startOfPeriodIndex = null;
    this.data = [];
    this.rateData = [];
    this.series = null;
  }
  DifferenceSeries.prototype.addPoint = function(options, redraw, shift, animation) {
    var idx = this.startOfPeriodIndex,
        dur = this.periodDuration,
        data = this.data, n = data.length;
    if (idx != null && n > 1) {
      while (idx < n && data[idx][0] < options[0] - dur) {
        idx++;
      }
      idx = idx - 1;

      if (idx >= 0) {
        var prevPoint = data[idx];
        var timeDiff = options[0] - prevPoint[0];
        var valueDiff = options[1] - prevPoint[1];
        var rate = valueDiff / (timeDiff / this.unitDuration);
        if (this.series) {
          this.series.addPoint([ options[0], rate ], redraw, shift, animation);
        } else {
          this.rateData.push([ options[0], rate ]);
        }

        this.startOfPeriodIndex = idx + 1;
      }
    } else {
      this.startOfPeriodIndex = 0;
    }
    this.data.push(options);
  };

  function makeEmpty(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }


  function toggleShowAll() {
    var showAll = ((''+location.hash).match('show-all'));
    if (showAll) {
      location.hash = '#';
    } else {
      location.hash = '#show-all';
    }

    return false;
  }



  var lastRedrawn = null;
  var downloaderSeries = {};

  function handleDownloaderClick(evt) {
    var tr = evt.target;
    while (tr && tr.nodeName!='TR' && tr.parentNode) {
      tr = tr.parentNode;
    }
    if (tr && tr.nodeName=='TR' && tr.downloader) {
      var downloader = tr.downloader;
      if (downloaderSeries[downloader]) {
        var series = downloaderSeries[downloader];
        if (series.visible)
          series.hide();
        else
          series.show();

        var span = document.getElementById('legend-'+downloader);
        if (span) {
          span.style.visibility = series.visible ? 'visible' : 'hidden';
        }

        chart.series[0].hide();
        chart.series[0].show();
      }
    }
  }

  function updateStats(msg, dupe) {
    stats.counts = msg.counts;
    stats.queuestats = msg.queuestats;
    stats.stats = msg.stats;
    if (!dupe) {
      if (!stats.downloader_bytes[msg.downloader]) {
        stats.downloader_bytes[msg.downloader] = 0;
        stats.downloader_count[msg.downloader] = 0;
        stats.downloaders.push(msg.downloader);
      }
      stats.downloader_count[msg.downloader] += msg.items.length;
    }
    for (var domain in msg.domain_bytes) {
      bytes = msg.domain_bytes[domain] * 1;
      if (!stats.domain_bytes[domain]) {
        stats.domain_bytes[domain] = 0;
      }
      stats.domain_bytes[domain] += bytes;
      stats.downloader_bytes[msg.downloader] += bytes;
      stats.total_bytes += bytes;
    }

  }

  function addLog(msg) {

  }

  function getLogHostURL() {
    console.log("loghost")
    if (document.location.protocol == 'http:') {
      return trackerConfig.logHost;
    } else {
      return trackerConfig.sslLogHost;
    }
  }

  function startLogClient() {
    console.log("start log")
    value = 0;
    var socket = io.connect(document.location.protocol+'//'+getLogHostURL()+'/'+trackerConfig.logChannel);
    socket.on("log_message", function(data) {
      var msg = JSON.parse(data);
      if (msg.downloader && msg.item && msg.bytes !== undefined) {
        
        updateStats(msg, msg.is_duplicate);

        switch (true) {
          case msg.downloader == 'fullpwnmedia':
            
            //console.log(msg)
            document.getElementById('count').innerHTML = stats.downloader_count.fullpwnmedia.toLocaleString()
            document.getElementById( 'loading' ).style.display = 'none';
            //console.log(stats)
            console.log(msg)
            value = value + msg.bytes;
            document.getElementById("ign").innerHTML = humanFileSize(stats.downloader_bytes.fullpwnmedia, true) + " - " + humanFileSize(value, true) + " since page load";
            break;
         case msg.downloader !== 'fullpwnmedia': 
         console.log('IGN')

          break;
      }
    }
    });
  }

  function initLog() {
    console.log("init log")
    jQuery.getJSON(document.location.protocol+'//'+getLogHostURL()+'/recent/'+(trackerConfig.logChannel), function(messages) {
      for (var i=0; i<messages.length; i++) {
        var msg = messages[i];
        if (msg.downloader && msg.item && msg.bytes !== undefined) {
          addLog(msg);
        }
      }
      startLogClient();
    });
  }

  var chart = null;



  var previousChartDataUrls = [];

  var stats = null;
  jQuery.getJSON(trackerConfig.statsPath, function(newStats) {
    stats = newStats;


    initLog();

    if (trackerConfig.updateStatusPath) {
      refreshUpdateStatus();
      window.setInterval(function() { refreshUpdateStatus(); }, 60000);
    }

  });


})(window.trackerConfig);
//https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string
function humanFileSize(bytes, si=false, dp=1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si 
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] 
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10**dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


  return bytes.toFixed(dp) + ' ' + units[u];
}
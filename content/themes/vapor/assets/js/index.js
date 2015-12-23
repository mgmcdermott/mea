/*globals jQuery, window */
(function($) {
  'use strict';
  var api = 'https://api.instagram.com/v1/';
  var userId = '45458342';
  var token = '?access_token=2306401040.ab103e5.ef5f498b4b03442cb3e34203258d3260';
  var initUrl = api + 'users/' + userId + '/media/recent/' + token;
  var urls = [];

  function getUrls(argUrl) {
    var currentUrl = argUrl || initUrl;
    urls.push(currentUrl);
    var promise = $.ajax({
      type: 'GET',
      dataType: 'jsonp',
      url: currentUrl,
      success: function(response) {
        var nextUrl = response.pagination.next_url;
        if (nextUrl) {
          getUrls(nextUrl);
        } else {
          getPhotos(urls)
        }
      }
    });
  }

  function getPhotos(urls) {
    var promises = [];
    var photos = [];
    _.each(urls, function(url) {
      var promise = $.ajax({
        type: 'GET',
        dataType: 'jsonp',
        url: url,
        success: function(response) {
          // debugger;
          _.each(response.data, function(photoObj) {
            var photo = {
                id: photoObj.id,
                tags: photoObj.tags,
                likes: photoObj.likes.count,
                caption: photoObj.caption.text,
                created: photoObj.created_time,
                thumbUrl: photoObj.images.thumbnail.url,
                url: photoObj.images.standard_resolution.url
              }
              // Eventually only push if photo has proper tag
            photos.push(photo);
          });
        }
      });
      promises.push(promise);
    });
    $.when.apply($, promises).done(function() {
      buildPhotoWall(photos);
    });
  }

  function shorterString(string) {
    if (string.length > 88) {
      return string.substring(0, 88) + '...';
    }
    return string;
  }

  function buildPhotoWall(photos) {
    var temp =
      '<figure itemprop="associatedMedia" itemscope itemtype="http://schema.org/ImageObject" class="photo-wrap">' +
        '<a class="photo-link" href="{photoUrl}" itemprop="contentUrl" data-size="640x640">' +
          '<img itemprop="thumbnail" src="{photoUrl}" alt="{caption}">' +
        '</a>' +
        '<figcaption itemprop="caption description">' +
          '<span class="photo-likes">' +
            '<i class="fa fa-heart photo-heart"></i> ' +
            '{likes}' +
            '</span>' +
          '<span class="photo-caption">{shortCaption}</span>' +
        '</figcaption>' +
      '</figure>';
    var html = '';
    // Sort photos by date created
    photos.sort(function(a, b) {
      var x = a.created;
      var y = b.created;
      return ((x > y) ? -1 : ((x < y) ? 1 : 0));
    });
    _.each(photos, function(photo) {
      // Remove all @'s to other instagram users
      var caption = photo.caption.toString().replace(/@.*(?=\s|$)/g, '');
      html += temp
        .replace('{id}', photo.id)
        .replace(/{shortCaption}/g, shorterString(caption))
        .replace(/{caption}/g, caption)
        .replace(/{photoUrl}/g, photo.url)
        .replace(/{thumbUrl}/g, photo.thumbUrl)
        .replace('{likes}', photo.likes.toString());
    });
    $('#freewall').html(html);
    var wall = new freewall('#freewall');
    wall.reset({
      selector: '.photo-wrap',
      animate: true,
      cellW: 340,
      cellH: 420,
      onResize: function() {
        wall.refresh();
      }
    });
    wall.fitWidth();
    initPhotoSwipeFromDOM('.free-wall');
    $(window).trigger('resize');
  }

  var initPhotoSwipeFromDOM = function(gallerySelector) {
    // parse slide data (url, title, size ...) from DOM elements
    // (children of gallerySelector)
    var parseThumbnailElements = function(el) {
      var thumbElements = el.childNodes,
        numNodes = thumbElements.length,
        items = [],
        figureEl,
        linkEl,
        size,
        item;

      for (var i = 0; i < numNodes; i++) {

        figureEl = thumbElements[i]; // <figure> element

        // include only element nodes
        if (figureEl.nodeType !== 1) {
          continue;
        }

        linkEl = figureEl.children[0]; // <a> element

        size = linkEl.getAttribute('data-size').split('x');

        // create slide object
        item = {
          src: linkEl.getAttribute('href'),
          w: parseInt(size[0], 10),
          h: parseInt(size[1], 10)
        };



        if (figureEl.children.length > 1) {
          // <figcaption> content
          item.title = figureEl.children[1].innerHTML;
        }

        if (linkEl.children.length > 0) {
          // <img> thumbnail element, retrieving thumbnail url
          item.msrc = linkEl.children[0].getAttribute('src');
        }

        item.el = figureEl; // save link to element for getThumbBoundsFn
        items.push(item);
      }

      return items;
    };

    // find nearest parent element
    var closest = function closest(el, fn) {
      return el && (fn(el) ? el : closest(el.parentNode, fn));
    };

    // triggers when user clicks on thumbnail
    var onThumbnailsClick = function(e) {
      e = e || window.event;
      e.preventDefault ? e.preventDefault() : e.returnValue = false;

      var eTarget = e.target || e.srcElement;

      // find root element of slide
      var clickedListItem = closest(eTarget, function(el) {
        return (el.tagName && el.tagName.toUpperCase() === 'FIGURE');
      });

      if (!clickedListItem) {
        return;
      }

      // find index of clicked item by looping through all child nodes
      // alternatively, you may define index via data- attribute
      var clickedGallery = clickedListItem.parentNode,
        childNodes = clickedListItem.parentNode.childNodes,
        numChildNodes = childNodes.length,
        nodeIndex = 0,
        index;

      for (var i = 0; i < numChildNodes; i++) {
        if (childNodes[i].nodeType !== 1) {
          continue;
        }

        if (childNodes[i] === clickedListItem) {
          index = nodeIndex;
          break;
        }
        nodeIndex++;
      }
      if (index >= 0) {
        // open PhotoSwipe if valid index found
        openPhotoSwipe(index, clickedGallery);
      }
      return false;
    };

    // parse picture index and gallery index from URL (#&pid=1&gid=2)
    var photoswipeParseHash = function() {
      var hash = window.location.hash.substring(1),
        params = {};
      if (hash.length < 5) {
        return params;
      }
      var vars = hash.split('&');
      for (var i = 0; i < vars.length; i++) {
        if (!vars[i]) {
          continue;
        }
        var pair = vars[i].split('=');
        if (pair.length < 2) {
          continue;
        }
        params[pair[0]] = pair[1];
      }
      if (params.gid) {
        params.gid = parseInt(params.gid, 10);
      }
      return params;
    };

    var openPhotoSwipe = function(index, galleryElement, disableAnimation, fromURL) {
      var pswpElement = document.querySelectorAll('.pswp')[0];
      var items = parseThumbnailElements(galleryElement);
      // define options (if needed)
      var options = {
        // define gallery index (for URL)
        galleryUID: galleryElement.getAttribute('data-pswp-uid'),
        getThumbBoundsFn: function(index) {
          // See Options -> getThumbBoundsFn section of documentation for more info
          var thumbnail = items[index].el.getElementsByTagName('img')[0], // find thumbnail
            pageYScroll = window.pageYOffset || document.documentElement.scrollTop,
            rect = thumbnail.getBoundingClientRect();
          return {
            x: rect.left,
            y: rect.top + pageYScroll,
            w: rect.width
          };
        }

      };

      // PhotoSwipe opened from URL
      if (fromURL) {
        if (options.galleryPIDs) {
          // parse real index when custom PIDs are used
          // http://photoswipe.com/documentation/faq.html#custom-pid-in-url
          for (var j = 0; j < items.length; j++) {
            if (items[j].pid == index) {
              options.index = j;
              break;
            }
          }
        } else {
          // in URL indexes start from 1
          options.index = parseInt(index, 10) - 1;
        }
      } else {
        options.index = parseInt(index, 10);
      }

      // exit if index not found
      if (isNaN(options.index)) {
        return;
      }

      if (disableAnimation) {
        options.showAnimationDuration = 0;
      }

      // Pass data to PhotoSwipe and initialize it
      var gallery = new PhotoSwipe(pswpElement, PhotoSwipeUI_Default, items, options);
      gallery.init();
    };

    // loop through all gallery elements and bind events
    var galleryElements = document.querySelectorAll(gallerySelector);

    for (var i = 0, l = galleryElements.length; i < l; i++) {
      galleryElements[i].setAttribute('data-pswp-uid', i + 1);
      galleryElements[i].onclick = onThumbnailsClick;
    }

    // Parse URL and open gallery if it contains #&pid=3&gid=1
    var hashData = photoswipeParseHash();
    if (hashData.pid && hashData.gid) {
      openPhotoSwipe(hashData.pid, galleryElements[hashData.gid - 1], true, true);
    }
  };

  $(document).ready(function() {
    // On the home page, move the blog icon inside the header
    // for better relative/absolute positioning.
    $('#blog-logo').prependTo('#site-head-content');
    getUrls();

  });
}(jQuery));

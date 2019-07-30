import cheerio from 'cheerio';
import { JSDOM } from 'jsdom';

export const isDynamicRoute = (path: string): boolean => {
  return path.split('/').some(snippet => snippet.startsWith(':'));
}

interface IChunkMap {
  js: string[];
  css: string[];
}

const _getDocumentHandler = (html: string, option?: object) => {
  return cheerio.load(html, {
    decodeEntities: false,
    recognizeSelfClosing: true,
    ...option,
  });
}

export const injectChunkMaps = (html: string, chunkMap: IChunkMap, publicPath: string): string => {
  const { js, css } = chunkMap;
  const $ = _getDocumentHandler(html);
  // filter umi.css and umi.*.css, htmlMap have includes
  const styles = css.filter(style => !/^umi\.\w+\.css$/g.test(style)) || [];
  styles.forEach(style => {
    $('head').append(`<link rel="stylesheet" href="${publicPath}${style}" />`)
  });
  // filter umi.js and umi.*.js
  const scripts = js.filter(script => !/^umi([.\w]*)?\.js$/g.test(script)) || [];
  scripts.forEach(script => {
    $('head').append(`<link rel="preload" href="${publicPath}${script}" as="script"/>`)
  })

  return $.html();
}

export const modifyTitle = (html: string, title: string) => {
  const $ = _getDocumentHandler(html);
  if (html && title) {
    $('title').text(title);
  }
  return $.html();
}

export const removeSuffixHtml = (path: string): string => {
  return path.replace('?', '')
    .replace('(', '')
    .replace(')', '')
    .replace(/\.(html|htm)/g, '')
}

const isHtmlPath = (path: string): boolean => {
  return /\.(html|htm)/g.test(path);
}

export const findJSON = (baseDir, fileName) => {
  const { join } = require('path');
  const { existsSync } = require('fs');
  const absFilePath = join(baseDir, fileName);
  if (existsSync(absFilePath)) {
    return absFilePath;
  }
}

export const fixHtmlSuffix = (route) => {
  if (route.path
    && route.path !== '/'
    && !isHtmlPath(route.path)
    && !isDynamicRoute(route.path)
    && !route.redirect
  ) {
    route.path = `${route.path}(.html)?`;
  }
}

export const getStaticRoutePaths = (routes) => {
  const _ = global.UMI_LODASH;
  return _.uniq(
    routes.reduce((memo, route) => {
      // filter dynamic Routing like /news/:id, etc.
      if (
        route.path
        && !isDynamicRoute(route.path)
        && !route.redirect
      ) {
        memo.push(removeSuffixHtml(route.path));
        if (route.routes) {
          memo = memo.concat(getStaticRoutePaths(route.routes));
        }
      }
      return memo;
    }, []),
  );
};

export const nodePolyfill = (url, context): any => {
  const _ = global.UMI_LODASH;
  let dom = new JSDOM('<body><div id="root"></div></body>', {
    url: url || 'http://localhost/',
  });

  let params = {
    // https://github.com/akiran/react-slick/issues/742
    matchMedia: query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
    }),
  };

  if (typeof context === 'object') {
    params = _.merge(context, params);
  } else if (typeof context === 'function') {
    params = _.merge(context(), params);
  }
  // { window }
  const mockGlobal = _.merge(dom, {
    window: params,
  })
  // mock first
  global.window = mockGlobal.window;
  // mock global
  const mountGlobal = ['document', 'location', 'navigator', 'Image', 'self'];
  mountGlobal.forEach(mount => {
    global[mount] = mockGlobal.window[mount];
  })

  // merge user global params
  Object.keys(params).forEach(key => {
    // just mount global key (filter mountGlobal)
    // like { USER_BAR: "foo" }
    // => global.USER_BAR = "foo";
    // => global.window.USER_BAR = "foo";
    if (!mountGlobal.includes(key)) {
      global[key] = params[key];
    }
  })

  return mockGlobal.window;
};

export const patchWindow = (context) => {
  let params = {};
  if (typeof context === 'object') {
    params = context;
  }
  Object.keys(params).forEach(key => {
    // just mock global.window.bar = '';
    global.window[key] = typeof params[key] === 'object'
      ? {
          ...global.window[key],
          ...params[key],
        }
      : params[key];
    global[key] = global.window[key];
  })
}

export const getSuffix = (filename: string): string => {
  return `${filename || 'index'}.html`;
}

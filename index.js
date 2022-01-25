const https = require("https");
const fs = require("fs");
const path = require("path");

const log = console.log;

function saveAsJSON(filename, data, callback) {
  fs.writeFile(
    path.resolve(__dirname, "json", filename + ".json"),
    data,
    function (err) {
      if (err) {
        console.log(err);
        return;
      }
      log(filename, "下载成功！");
      typeof callback === "function" && callback();
    }
  );
}

function parseDownloadTask(dir, filename, fn) {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(__dirname, dir, filename), function (err, data) {
      // 读取文件失败/错误
      if (err) {
        throw err;
      }
      resolve(fn(data));
    });
  });
}

function downloader(url, filename, callback) {
  const writeStream = fs.createWriteStream(
    path.resolve(__dirname, "images", filename + ".png")
  );
  https.get(url, (res) => {
    res.pipe(writeStream);
    res.on("end", () => {
      typeof callback === "function" && callback();
    });
  });
}

function createDownloader(dir, fileType) {
  fileType = fileType ? `.${fileType}`: ""
  return function downloader(url, filename, callback) {
    const writeStream = fs.createWriteStream(
      path.resolve(__dirname, dir, `${filename}${fileType}`)
    );
    https.get(url, (res) => {
      res.pipe(writeStream);
      res.on("end", () => {
        typeof callback === "function" && callback();
      });
 
    }).on('error', (e) => {
      log("error");
      log(url);
      typeof callback === "function" && callback();    });;
  };
}

function downloadMonitor(list, paramsFn, downloader, start = 0) {
  let end = list.length;
  if (start < end) {
    if (!paramsFn(list[start])) {
      return;
    }
    const { url, name } = paramsFn(list[start]);
    downloader(url, name, () => {
      log("下载完成", start);
      downloadMonitor(list, paramsFn, downloader, start + 1);
    });
  } else {
    log(start, end, "下载完成");
  }
}

function downloadPage(pageSize, pageNum, maxPage) {
  const url = `https://www.makeapie.com/chart/list?builtinTags%5B%5D=category-work&sortBy=rank&pageSize=${pageSize}&pageNumber=${pageNum}&author=all`;
  https.get(url, (res) => {
    var resultData = "";
    res.on("data", (d) => {
      process.stdout.write(d);
      resultData += d;
    });
    res.on("end", () => {
      const filename = "page" + pageNum;

      saveAsJSON(filename, resultData, () => {
        if (pageNum < maxPage) {
          downloadPage(pageSize, pageNum + 1, maxPage);
        }
      });
    });
  });
}

function readdir(dir) {
  return new Promise((resolve, rejects) => {
    fs.readdir(path.resolve(__dirname, dir), function (err, list) {
      if (err) {
        throw err;
      }
      resolve(list);
    });
  });
}

function urlformatFilename(url, formart = "00000") {
  return url.replace(/\//g, formart);
}

async function main() {
  const maxPage = 580;
  const pageSize = 32;
  let pageNum = 0;

  // downloadPage(pageSize, pageNum, maxPage);

  // const fileList = await readdir("json");
  // const dataList = [];
  // for (const file of fileList) {
  //   const charts = await parseDownloadTask("json", file, function (data) {
  //     return JSON.parse(data).data.charts;
  //   });
  //   dataList.push(...charts);
  // }

  // const dataDownloader = createDownloader("data", "json");
  // const infoBaseUrl = "https://www.makeapie.com/chart/get"
  // downloadMonitor(dataList, function (item) {
  //   return {
  //     url: `${infoBaseUrl}/${item.cid}`,
  //     name: item.cid
  //   }
  // }, dataDownloader);

  const dataJson = await readdir("data");
  const dataDetailList = [];
  for (const file of dataJson) {
    const data = await parseDownloadTask("data", file, function (data) {
      return JSON.parse(data).data;
    });
    if (data.externalScripts) {
      dataDetailList.push(data);
    }
  }

  let externalScriptList = dataDetailList
    .map((item) => item.externalScripts.split(","))
    .flat();

  const unrepeatedExternalScriptList = [...new Set(externalScriptList)]
    .filter((item) => !item.includes("//"))
    .filter((item) => item.includes(".js"));

  // console.log(externalScriptList.length, unrepeatedExternalScriptList.length);

  log(unrepeatedExternalScriptList.length);
  const scriptDownloader = createDownloader("script", "");
  const scriptBaseUrl = "https://gallerybox.makeapie.com";
  downloadMonitor(
    unrepeatedExternalScriptList,
    function (item) {
      console.log(`${scriptBaseUrl}${item}`, urlformatFilename(item));
      return {
        url: `${scriptBaseUrl}${item}`,
        name: urlformatFilename(item),
      };
    },
    scriptDownloader
  );
}

main();

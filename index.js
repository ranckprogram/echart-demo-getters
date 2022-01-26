const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const log = console.log;

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

/**
 * 解析目录读取json返回js对象
 *
 * @param {*} dir
 * @param {*} filename
 * @param {*} fn
 * @return {*} Promise
 */
function parseDownloadTask(dir, filename, fn) {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(__dirname, dir, filename), function (err, data) {
      if (err) {
        throw err;
      }
      resolve(fn(data));
    });
  });
}

async function parseTaskByDir(dir, fn) {
  const fileList = await readdir(dir);
  const dataList = [];
  for (const file of fileList) {
    const data = await parseDownloadTask(dir, file, fn);
    dataList.push(data);
  }
  return dataList;
}

async function exitsFolder(dir) {
  const absPath = path.resolve(__dirname, dir);
  try {
    await fs.promises.stat(absPath);
  } catch (e) {
    await fs.promises.mkdir(absPath, { recursive: true });
  }
}

/**
 * 创建下载器。指定存放路径和文件类型
 *
 * @param {*} dir
 * @param {*} fileType
 * @return {*} downloader 下载器
 *
 * 下载器 downloader
 * 下载出错时，会自动进入下一个
 * TODO：考虑做个错误收集
 *
 * @param {*} url
 * @param {*} filename
 * @param {*} callback
 */
function createDownloader(dir, fileType) {
  fileType = fileType ? `.${fileType}` : "";

  return async function downloader(url, filename, callback) {
    try {
      await exitsFolder(dir);
    } catch (e) {
      throw Error(e.msg);
    }
    const writeStream = fs.createWriteStream(
      path.resolve(__dirname, dir, `${filename}${fileType}`)
    );
    https
      .get(url, (res) => {
        res.pipe(writeStream);
        res.on("end", () => {
          typeof callback === "function" && callback();
        });
      })
      .on("error", (e) => {
        typeof callback === "function" && callback();
      });
  };
}

/**
 * 控制异步顺序下载，一次下载一个，报错则下一个，直到下载完成，发出完成信号
 *
 * @param {*} list
 * @param {*} paramsFn
 * @param {*} downloader
 * @param {number} [start=0]
 * @return {*}
 */
function downloadMonitor(
  list,
  paramsFn,
  downloader,
  finishCallback = () => {},
  start = 0
) {
  let end = list.length;
  if (start < end) {
    if (!paramsFn(list[start])) {
      return;
    }
    const { url, name } = paramsFn(list[start]);
    downloader(url, name, () => {
      log(name, "下载完成", start);
      downloadMonitor(list, paramsFn, downloader, finishCallback, start + 1);
    });
  } else {
    log(start, end, "下载完成");
    finishCallback();
  }
}

function urlformatFilename(url, formart = "00000") {
  return url.replace(/\//g, formart);
}

/**
 *  根据分页获取每一页数据
 *
 */
function getDateList(dir) {
  return new Promise((resolve, reject) => {
    const maxPage = 580;
    const pageSize = 32;
    let pageNum = 0;

    const dataDownloader = createDownloader(dir, "json");
    const dataList = Array.from({ length: maxPage }, function (_, index) {
      return index + 1;
    });
    downloadMonitor(
      dataList,
      function (item) {
        pageNum = item;
        const url = `https://www.makeapie.com/chart/list?builtinTags%5B%5D=category-work&sortBy=rank&pageSize=${pageSize}&pageNumber=${pageNum}&author=all`;
        return {
          url,
          name: item,
        };
      },
      dataDownloader,
      function () {
        resolve();
      }
    );
  });
}

function getAllThumbnail(dataList) {
  return new Promise((resolve, reject) => {
    const dataDownloader = createDownloader("images", "png");
    downloadMonitor(
      dataList,
      function (item) {
        return {
          url: item.thumbnailURL,
          name: item.cid,
        };
      },
      dataDownloader,
      function () {
        resolve();
      }
    );
  });
}

function getDataDetail(dataList) {
  return new Promise((resolve, reject) => {
    const infoBaseUrl = "https://www.makeapie.com/chart/get";
    const dataDownloader = createDownloader("detail", "json");

    downloadMonitor(
      dataList,
      function (item) {
        return {
          url: `${infoBaseUrl}/${item.cid}`,
          name: item.cid,
        };
      },
      dataDownloader,
      function () {
        resolve();
      }
    );
  });
}

function getExternalScript(dataList) {
  return new Promise((resolve, reject) => {
    const scriptBaseUrl = "https://gallerybox.makeapie.com";
    const dataDownloader = createDownloader("script", "");
    downloadMonitor(
      dataList,
      function (item) {
        return {
          url: `${scriptBaseUrl}${item}`,
          name: urlformatFilename(item),
        };
      },
      dataDownloader,
      function () {
        resolve();
      }
    );
  });
}

/**
 * 1. 下载数据列表
 * 2. 根据数据列表获取缩略图url下载缩略图
 * 3. 根据数据列表获取id，拼接url下载详情
 * 4. 根据详情解析额外脚本，下载非第三方脚本
 */
async function main() {
  const dataListDir = "data";
  const detailDir = "detail";

  spawnSync("rm", ["-rf", "data", "detail", "images", "script"]);

  getDateList(dataListDir)
    .then(async () => {
      const allPageDataList = (
        await parseTaskByDir(dataListDir, function (data) {
          return JSON.parse(data).data.charts;
        })
      ).flat();
      return allPageDataList;
    })
    .then(async (allPageDataList) => {
      await getAllThumbnail(allPageDataList);
      return allPageDataList;
    })
    .then(async (allPageDataList) => {
      await getDataDetail(allPageDataList);
    })
    .then(async () => {
      const allDetailDataList = await parseTaskByDir(
        detailDir,
        function (data) {
          return JSON.parse(data).data;
        }
      );

      let externalScriptList = allDetailDataList
        .map((item) => item.externalScripts.split(","))
        .flat();

      const unrepeatedExternalScriptList = [...new Set(externalScriptList)]
        .filter((item) => !item.includes("//"))
        .filter((item) => item.includes(".js"));

      getExternalScript(unrepeatedExternalScriptList);
    });
}

main();

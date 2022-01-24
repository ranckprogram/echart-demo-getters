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
      console.log(filename, "下载成功！");
      typeof callback === "function" && callback();
    }
  );
}

// 读取指定目录的的文件，依次循环，逐渐同步遍历
// function read

function parseDownloadTask(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(
      path.resolve(__dirname, "json", filename),
      function (err, data) {
        // 读取文件失败/错误
        if (err) {
          throw err;
        }
        // 读取文件成功
        const charts = JSON.parse(data).data.charts;
        resolve(charts);
      }
    );
  });
}

// 可能出现读的速度很快写的速度很慢，造成部分chunk丢失？？
function downloader(url, filename, callback) {
  const writeStream = fs.createWriteStream(
    path.resolve(__dirname, "images", filename + ".png")
  );
  https.get(url, (res) => {
    res.pipe(writeStream);
    res.on("end", () => {
      log(filename, "下载成功");
      typeof callback === "function" && callback();
    });
  });
}

function downloadMonitor(list, start = 0, downloader) {
  let end = list.length;
  if (start < end) {
    const { cid, thumbnailURL } = list[start];
    downloader(thumbnailURL, cid, () => {
      downloadMonitor(list, start + 1, downloader);
    });
  } else {
    console.log(start, end, "下载完成");
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

function readdir() {
  return new Promise((resolve, rejects) => {
    fs.readdir(path.resolve(__dirname, "json"), function (err, list) {
      if (err) {
        throw err;
      }
      resolve(list);
    });
  });
}

async function main() {
  const maxPage = 580;
  const pageSize = 32;
  let pageNum = 0;

  // downloadPage(pageSize, pageNum, maxPage);

  const fileList = await readdir();
  const dataList = [];
  for (const file of fileList) {
    const charts = await parseDownloadTask(file);
    dataList.push(...charts);
  }

  // downloadMonitor(dataList, 0, downloader);
  log(dataList[0], dataList.length);
}

main();

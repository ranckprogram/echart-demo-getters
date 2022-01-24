const https = require("https");
const fs = require("fs");
const path = require("path");


const log = console.log;

function getAllResourceList() {}

// 5000 条差不多了
function filterHighQualityResource() {}

function writeToFile() {}

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
  fs.readFile(
    path.resolve(__dirname, "json", filename + ".json"),
    function (err, data) {
      // 读取文件失败/错误
      if (err) {
        throw err;
      }
      // 读取文件成功
      console.log("utf-8: ", JSON.parse(data).data.charts);
      const charts = JSON.parse(data).data.charts;
    }
  );
}


// 可能出现读的速度很快写的速度很慢，造成部分chunk丢失？？
function downloadImg(url, filename, callback) {
  const writeStream = fs.createWriteStream(
    path.resolve(__dirname, "images", filename + ".png")
  );
  https.get(url, (res) => {
    res.pipe(writeStream);
  });
}

function download() {}

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

function main() {
  const allList = getAllResourceList();
  const maxPage = 580;
  const pageSize = 32;
  let pageNum = 0;

  // downloadPage(pageSize, pageNum, maxPage);


  parseDownloadTask()
  // downloadImg(
  //   "https://www.makeapie.com/ecg-storage/ec_gallery_thumbnail/xRCTSEN58U.png?v=1641539836825",
  //   "ddd"
  // );
}

main();

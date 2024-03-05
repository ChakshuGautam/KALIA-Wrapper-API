const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");

const app = express();
const port = 3000;
app.use(bodyParser.json());

app.get("/:id", async (req, res) => {
  const userInput = req.params.id;
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto("https://kaliaportal.odisha.gov.in/TrackToken.aspx");

    await page.type("#txttokenNo", userInput);
    await page.click("#Btn_Show");

    await page.waitForSelector("#viewpart");

    const result = await page.evaluate(
      () => document.querySelector("#viewpart").innerHTML
    );

    const htmlContent = result;
    const $ = cheerio.load(htmlContent);

    let extractedData = {
      personalDetails: {},
      onlineGrievanceApplicationStatus: "",
      eligibilityStatus: {},
      paymentAccountDetails: [],
      reasonsOfIneligibility: [],
    };

    $("table")
      .eq(0)
      .find("tr")
      .each((i, el) => {
        if (i > 0) {
          const key = $(el).find("td").eq(0).text().trim();
          const value = $(el).find("td").eq(1).find("span").text().trim();
          if (key && value) {
            extractedData.personalDetails[key] = value;
          }

          const key2 = $(el).find("td").eq(2).text().trim();
          const value2 = $(el).find("td").eq(3).find("span").text().trim();
          if (key2 && value2) {
            extractedData.personalDetails[key2] = value2;
          }
        }
      });

    const grievanceStatus = $("table")
      .eq(1)
      .find("tr")
      .eq(1)
      .find("td")
      .text()
      .trim();
    if (grievanceStatus) {
      extractedData.onlineGrievanceApplicationStatus = grievanceStatus;
    }

    $("table")
      .eq(2)
      .find("tr")
      .each((i, el) => {
        if (i === 1) {
          const key = $(el).find("td").eq(0).text().trim();
          const value = $(el).find("td").eq(1).find("span").text().trim();
          if (key && value) {
            extractedData.eligibilityStatus[key] = value;
          }
        }
      });

    $("#grdineligible tr").each((i, el) => {
      if (i > 0) {
        const reason = $(el).find("td").eq(1).text().trim();
        if (reason) {
          extractedData.reasonsOfIneligibility.push(reason);
        }
      }
    });

    const paymentDetailsTables = $("table").slice(4);

    const paymentDetails = []

    paymentDetailsTables.each((idx, table) => {
      const tableData = {}
      $(table).find("tr").each((rowIdx, tableRow) => {
        if(rowIdx == 0) {
          return;
        }
        const key1 = $(tableRow).find("td").eq(0).text().trim();
        const value1 = $(tableRow).find("td").eq(1).find("span").text().trim()
        const key2 = $(tableRow).find("td").eq(2).text().trim();
        const value2 = $(tableRow).find("td").eq(3).find("span").text().trim()
        if(key1 && value1) {
          tableData[key1] = value1;
        }
        if(key2 && value2) {
          tableData[key2] = value2;
        }
      })
      paymentDetails.push(tableData);
    })

    extractedData.paymentAccountDetails = paymentDetails

    console.log(JSON.stringify(extractedData, null, 2));

    res.send(JSON.stringify(extractedData, null, 2));

    await browser.close();
  } catch (error) {
    console.log(error);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

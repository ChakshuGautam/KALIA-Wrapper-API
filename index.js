const express = require("express");
const bodyParser = require("body-parser");
const browserManager = require("./browserManager");
const cheerio = require("cheerio");

const app = express();
const port = 3000;
let browser = null;
app.use(bodyParser.json());


app.get("/:id", async (req, res) => {
  const userInput = req.params.id;
  try {

    if(!browser) {
      browser = await browserManager.launchBrowser();
    }

    const page = await browser.newPage();
    await page.goto("https://kaliaportal.odisha.gov.in/TrackToken.aspx");

    await page.type("#txttokenNo", userInput);
    await page.click("#Btn_Show");
    await Promise.race([
      page.waitForSelector("#viewpart"),
      // if aadhaar Number is invalid
      page.waitForFunction(() => {
        const scripts = document.querySelectorAll('script');
        for(const script of scripts) {
          if(script.innerText.includes("jAlert")) {
            return true;
          }
        }
        return false;
      })
    ]);
    const viewpart = await page.$('#viewpart');
    if(viewpart) {
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

      const grievanceStatus = {}
      const grievanceStatusTableRows = $("table").eq(1).find("tr").slice(1);
      if(grievanceStatusTableRows.length > 1) {
        grievanceStatusTableRows.each((idx, row) => {
          const grievanceStatusKey1 = $(row).find("td").eq(0).text().trim();
          const grievanceStatusValue1 = $(row).find("td").eq(1).find("span").text().trim();
          grievanceStatus[grievanceStatusKey1] = grievanceStatusValue1
          if(idx < 3) {
            const grievanceStatusKey2 = $(row).find("td").eq(2).text().trim();
            const grievanceStatusValue2 = $(row).find("td").eq(3).find("span").text().trim();
            grievanceStatus[grievanceStatusKey2] = grievanceStatusValue2
          }
        })
      } else {
        grievanceStatus["message"] = "No data found"
      }

      extractedData.onlineGrievanceApplicationStatus = grievanceStatus;

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
          
          // skip header row of every paymentInstallment table
          if(rowIdx == 0) {
            return;
          }

          // Each paymentInstallment row has two key-value pairs describing the current installment data
          const paymentInstallmentKey1 = $(tableRow).find("td").eq(0).text().trim();
          const paymentInstallmentValue1 = $(tableRow).find("td").eq(1).find("span").text().trim()
          const paymentInstallmentKey2 = $(tableRow).find("td").eq(2).text().trim();
          const paymentInstallmentValue2 = $(tableRow).find("td").eq(3).find("span").text().trim()

          if(paymentInstallmentKey1 && paymentInstallmentValue1) {
            tableData[paymentInstallmentKey1] = paymentInstallmentValue1;
          }
          if(paymentInstallmentKey2 && paymentInstallmentValue2) {
            tableData[paymentInstallmentKey2] = paymentInstallmentValue2;
          }
        })
        paymentDetails.push(tableData);
      })

      extractedData.paymentAccountDetails = paymentDetails

      console.log(JSON.stringify(extractedData, null, 2));

      res.json(extractedData);
    } else {
      res.json({
        message: "Invalid aadhaar number"
      })
    }
    await page.close();
  } catch (error) {
    console.log(error);
  }
});

const closeBrowser = async () => {
  if(browser) {
    await browser.close();
    browser = null;
  }
}

app.on('close', closeBrowser)

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit();
})

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit();
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

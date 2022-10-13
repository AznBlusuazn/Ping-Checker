//Version 1.00 - 2022.10.12

const dotenv = require("dotenv");
const smtp = require("nodemailer");
const ping = require("ping");
const today = new Date();
const date = ("0" + today.getDate()).slice(-2);
const month = ("0" + (today.getMonth() + 1)).slice(-2);
const year = today.getFullYear();
const hours = today.getHours();
const minutes = today.getMinutes();
const seconds = today.getSeconds();
const justDate = `${year}${month}${date}`
const fullDate = `${justDate}_${hours}${minutes}${seconds}`
const fileName = `Log_${justDate}.log`
const logger = require("node-logger").createLogger(fileName);
logger.format = function (level, date, message) {
    return `[${level} ${date.getHours().toString()}:${date
    .getMinutes()
    .toString()}:${date.getSeconds().toString()}]${message}`;
};
const os = process.platform;

dotenv.config();

let transport, alive, result, xReboot, xMail;

const smtpHost = process.env.SMTP_HOST,
    smtpPort = process.env.SMTP_PORT,
    smtpSSL = process.env.SMTP_SSL,
    smtpUser = process.env.SMTP_EMAIL,
    smtpPass = process.env.SMTP_PASS,
    toEmail = process.env.RECEPIENT,
    pingAddr = process.env.PING

if (process.env.REBOOT == "true") {
    xReboot = Boolean(true)
} else {
    xReboot = Boolean(false)
};
if (process.env.EMAIL == "true") {
    xMail = Boolean(true)
} else {
    xMail = Boolean(false)
};

const buildSMTP = async () => {
    transport = smtp.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSSL,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        }
    })
}

const main = async () => {
    logger.info(`Starting Ping Test of ${pingAddr}...`)
    await ping.promise
        .probe(pingAddr)
        .then(async (isAlive) => {
            alive = isAlive
        });
    await buildSMTP();
    if (alive.alive) {
        result = "[SUCCESS]"
        logger.info(`Ping of ${pingAddr} was SUCCESSFUL!`);
    } else {
        result = "[FAILURE]"
        logger.error(`Ping of ${pingAddr} FAILED!`);
    };
    if (xMail) {
        try {
            await sendEmail();
            logger.info(`E-Mail Sent to ${toEmail} with Results.`);
        } catch (ex) {
            logger.error(`E-Mail Failed to ${toEmail} with reason of ${ex.toString}`);
        }
    }
    if (xReboot) {
        try {
            await hostReboot();
            logger.info(`${pingAddr} Reboot Executed SUCCESSFULLY.`);
        } catch (ex) {
            logger.error(`${pingAddr} Reboot attempt FAILED.`);
        }
    }
}

const sendEmail = async () => {
    let server, subjText, bodyText, info, wordResult, wordReboot = "";
    if (os == "win32") {
        server = "Windows"
    }
    if (os == "linux") {
        server = "Linux"
    }
    if (os == "darwin") {
        server = "MacOS"
    }
    if (result == "[SUCCESS]") {
        wordResult = "was SUCCESSFUL in ";
        if (xReboot) {
            wordReboot = "No action needed for the system."
        };
    }
    if (result == "[FAILURE]") {
        wordResult = "FAILED ";
        if (xReboot) {
            wordReboot = "A system reboot was executed to attempt to resolve this."
        } else {
            wordReboot = "A system reboot is RECOMMENDED to attempt to resolve this."
        }
    }
    subjText = `${fullDate} - ${pingAddr} Ping Test - ${result}`;
    bodyText = `[${fullDate}]${`\r\n\r\n`} ${server} Server (${pingAddr}) ${wordResult}the Ping Test.${`\r\n\r\n`}${wordReboot}`
    info = await transport.sendMail({
        from: smtpUser,
        to: toEmail,
        subject: subjText,
        text: bodyText,
    });
}

const hostReboot = async () => {
    if (os == "win32") {
        require('child_process').exec('shutdown /r /t 0', function (msg) {
            logger.info(msg)
        });
        return true;
    }
    if (os == "linux" || os == "darwin") {
        require('child_process').exec('sudo /sbin/shutdown -r now', function (msg) {
            logger.info(msg)
        });
        return true;
    }
}

main()
    .then(logger.info("Ping Test Complete."))
    .then(process.exit.bind(this, 0))
    .catch(err => {
        logger.error(`APPLICATION ERROR! ${err}`);
        process.exit(1);
    });
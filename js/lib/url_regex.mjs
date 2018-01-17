// Largely taken from https://github.com/aosp-mirror/platform_frameworks_base/blob/master/core/java/android/util/Patterns.java

const PROTOCOL = `(?:http|https):\\/\\/`;
const USER_INFO = `(?:[a-zA-Z0-9\\$_\\.\\+!\\*'\\(\\),;\\?&=-]|(?:%[a-fA-F0-9]{2})){1,64}(?::(?:[a-zA-Z0-9\\$_\\.\\+!\\*'\\(\\),;\\?&=-]|(?:%[a-fA-F0-9]{2})){1,25})?@`;

const IP_OCTET = `25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]`;
const IP_ADDR = `((${IP_OCTET})\\.(${IP_OCTET}|0)\\.(${IP_OCTET}|0)\\.(${IP_OCTET}))`;

const UCS_CHAR = `\u{00A0}-\u{D7FF}\u{F900}-\u{FDCF}\u{FDF0}-\u{FFEF}\uD800\uDC00-\uD83F\uDFFD\uD840\uDC00-\uD87F\uDFFD\uD880\uDC00-\uD8BF\uDFFD\uD8C0\uDC00-\uD8FF\uDFFD\uD900\uDC00-\uD93F\uDFFD\uD940\uDC00-\uD97F\uDFFD\uD980\uDC00-\uD9BF\uDFFD\uD9C0\uDC00-\uD9FF\uDFFD\uDA00\uDC00-\uDA3F\uDFFD\uDA40\uDC00-\uDA7F\uDFFD\uDA80\uDC00-\uDABF\uDFFD\uDAC0\uDC00-\uDAFF\uDFFD\uDB00\uDC00-\uDB3F\uDFFD\uDB44\uDC00-\uDB7F\uDFFD`;

const LABEL_CHAR = `a-zA-Z0-9${UCS_CHAR}`;
const IRI_LABEL = `[${LABEL_CHAR}](?:[${LABEL_CHAR}_-]{0,61}[${LABEL_CHAR}]){0,1}`;

const CHAR_TLD = `a-zA-Z${UCS_CHAR}`;
const PUNY_TLD = `xn\\-\\-[\\w\\-]{0,58}\\w`;

const TLD = `(${PUNY_TLD}|[${CHAR_TLD}]{2,63})`;
const DOMAIN = `(?:(?:${IRI_LABEL}(?:\\.(?=\\S))?)+|${IP_ADDR})`;
const PORT_NUMBER = `:\\d{1,5}`;
const WORD_BOUNDARY = `(?:\\b|$|^)`;

const PATH_AND_QUERY = `[/\\?](?:(?:[${LABEL_CHAR};/\\?:@&=#~\\.\\+!\\*'\\(\\),_\\$-])|(?:%[a-fA-F0-9]{2}))*`;

const WEB_URL_WITH_PROTOCOL = `(${WORD_BOUNDARY}(?:(?:${PROTOCOL}(?:${USER_INFO})?)(?:${DOMAIN})?(?:${PORT_NUMBER})?)(${PATH_AND_QUERY})?${WORD_BOUNDARY})`;

const WEB_URL = new RegExp(WEB_URL_WITH_PROTOCOL, 'gui');

export default WEB_URL;

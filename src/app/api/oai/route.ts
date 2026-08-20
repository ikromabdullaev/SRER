import type { NextRequest } from "next/server";
import { journal, absoluteUrl } from "@/config/journal";
import {
  OAI_PAGE_SIZE,
  dublinCore,
  earliestDatestamp,
  encodeToken,
  decodeToken,
  getRecord,
  listRecords,
  listSets,
  recordHeader,
  slugFromIdentifier,
  xmlEscape,
} from "@/lib/oai";

/**
 * OAI-PMH 2.0 (SPEC.md §5.4).
 *
 * Required by DOAJ and by most regional aggregators, and the difference
 * between being harvested and being ignored.
 *
 * Dynamic by definition: every response depends on the query string. The
 * `/api` prefix is excluded from the locale proxy so a harvester following
 * this URL is never 308'd to a locale prefix — a harvester that gets
 * redirected is a harvester that gives up.
 */
export const dynamic = "force-dynamic";

const BASE_URL = absoluteUrl("/api/oai");
const SUPPORTED_PREFIX = "oai_dc";

function now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function envelope(request: string, body: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${now()}</responseDate>
  ${request}
  ${body}
</OAI-PMH>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      // Harvesters poll; a short cache spares the database without making
      // new records wait long to be visible.
      "Cache-Control": "public, max-age=300",
    },
  });
}

function requestElement(params: URLSearchParams, echo: boolean): string {
  if (!echo) return `<request>${xmlEscape(BASE_URL)}</request>`;
  const attrs = [...params.entries()]
    .map(([k, v]) => `${k}="${xmlEscape(v)}"`)
    .join(" ");
  return `<request ${attrs}>${xmlEscape(BASE_URL)}</request>`;
}

/** On error the `request` element must NOT echo the arguments (OAI-PMH 3.2). */
function error(params: URLSearchParams, code: string, message: string): Response {
  const echo = code !== "badVerb" && code !== "badArgument";
  return envelope(
    requestElement(params, echo),
    `<error code="${code}">${xmlEscape(message)}</error>`,
  );
}

/** OAI granularity: YYYY-MM-DD or YYYY-MM-DDThh:mm:ssZ. */
function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) ||
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const verb = params.get("verb");

  if (!verb) return error(params, "badVerb", "No verb supplied.");

  const known = [
    "Identify",
    "ListMetadataFormats",
    "ListSets",
    "ListIdentifiers",
    "ListRecords",
    "GetRecord",
  ];
  if (!known.includes(verb)) {
    return error(params, "badVerb", `Unsupported verb: ${verb}`);
  }

  const echo = requestElement(params, true);

  try {
    switch (verb) {
      case "Identify":
        return envelope(
          echo,
          `<Identify>
    <repositoryName>${xmlEscape(journal.name)}</repositoryName>
    <baseURL>${xmlEscape(BASE_URL)}</baseURL>
    <protocolVersion>2.0</protocolVersion>
    <adminEmail>${xmlEscape(journal.adminEmail)}</adminEmail>
    <earliestDatestamp>${await earliestDatestamp()}</earliestDatestamp>
    <!--
      "no" until open decision D3 settles what a withdrawn article does.
      Declaring "persistent" and then dropping a record from the feed is a
      protocol violation that fails a DOAJ review, so the honest declaration
      is that this repository does not yet maintain deletion information.
    -->
    <deletedRecord>no</deletedRecord>
    <granularity>YYYY-MM-DDThh:mm:ssZ</granularity>
  </Identify>`,
        );

      case "ListMetadataFormats": {
        // oai_dc is mandatory and is the only format offered.
        const identifier = params.get("identifier");
        if (identifier) {
          const slug = slugFromIdentifier(identifier);
          if (!slug || !(await getRecord(slug))) {
            return error(params, "idDoesNotExist", "No such record.");
          }
        }
        return envelope(
          echo,
          `<ListMetadataFormats>
    <metadataFormat>
      <metadataPrefix>oai_dc</metadataPrefix>
      <schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>
      <metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>
    </metadataFormat>
  </ListMetadataFormats>`,
        );
      }

      case "ListSets": {
        const sets = await listSets();
        if (sets.length === 0) {
          return error(params, "noSetHierarchy", "No sets are defined.");
        }
        return envelope(
          echo,
          `<ListSets>
    ${sets
      .map(
        (s) =>
          `<set><setSpec>${xmlEscape(s.spec)}</setSpec><setName>${xmlEscape(
            s.name,
          )}</setName></set>`,
      )
      .join("\n    ")}
  </ListSets>`,
        );
      }

      case "GetRecord": {
        const identifier = params.get("identifier");
        const prefix = params.get("metadataPrefix");
        if (!identifier || !prefix) {
          return error(
            params,
            "badArgument",
            "GetRecord requires identifier and metadataPrefix.",
          );
        }
        if (prefix !== SUPPORTED_PREFIX) {
          return error(params, "cannotDisseminateFormat", `Unknown format: ${prefix}`);
        }
        const slug = slugFromIdentifier(identifier);
        const record = slug ? await getRecord(slug) : null;
        if (!record) {
          return error(params, "idDoesNotExist", "No such record.");
        }
        return envelope(
          echo,
          `<GetRecord><record>${recordHeader(record)}<metadata>${dublinCore(
            record,
          )}</metadata></record></GetRecord>`,
        );
      }

      case "ListIdentifiers":
      case "ListRecords": {
        const token = params.get("resumptionToken");
        let state = { offset: 0 } as {
          offset: number;
          set?: string;
          from?: string;
          until?: string;
        };

        if (token) {
          // A resumption token is exclusive of every other argument except
          // the verb itself.
          const others = [...params.keys()].filter(
            (k) => k !== "verb" && k !== "resumptionToken",
          );
          if (others.length > 0) {
            return error(
              params,
              "badArgument",
              "resumptionToken cannot be combined with other arguments.",
            );
          }
          const decoded = decodeToken(token);
          if (!decoded) {
            return error(params, "badResumptionToken", "Token not recognised.");
          }
          state = decoded;
        } else {
          const prefix = params.get("metadataPrefix");
          if (!prefix) {
            return error(params, "badArgument", "metadataPrefix is required.");
          }
          if (prefix !== SUPPORTED_PREFIX) {
            return error(
              params,
              "cannotDisseminateFormat",
              `Unknown format: ${prefix}`,
            );
          }
          for (const key of ["from", "until"] as const) {
            const value = params.get(key);
            if (value && !validDate(value)) {
              return error(params, "badArgument", `${key} is not a valid date.`);
            }
            if (value) state[key] = value;
          }
          const set = params.get("set");
          if (set) state.set = set;
        }

        const { records, hasMore } = await listRecords(state);

        if (records.length === 0) {
          return error(
            params,
            "noRecordsMatch",
            "Nothing matches those arguments.",
          );
        }

        const resumption = hasMore
          ? `<resumptionToken>${encodeToken({
              ...state,
              offset: state.offset + OAI_PAGE_SIZE,
            })}</resumptionToken>`
          : // An empty token closes the sequence, which is how a harvester
            // knows the list ended rather than was cut off.
            state.offset > 0
            ? `<resumptionToken/>`
            : "";

        const body =
          verb === "ListIdentifiers"
            ? records.map((r) => recordHeader(r)).join("\n    ")
            : records
                .map(
                  (r) =>
                    `<record>${recordHeader(r)}<metadata>${dublinCore(
                      r,
                    )}</metadata></record>`,
                )
                .join("\n    ");

        return envelope(echo, `<${verb}>\n    ${body}\n    ${resumption}\n  </${verb}>`);
      }

      default:
        return error(params, "badVerb", "Unsupported verb.");
    }
  } catch (caught) {
    // A harvester needs a protocol-shaped answer even when we fail, or it
    // records the repository as broken rather than momentarily unavailable.
    const message =
      caught instanceof Error ? caught.message : "Unexpected failure.";
    return error(params, "badArgument", message);
  }
}

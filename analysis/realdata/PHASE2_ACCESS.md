# Phase 2 access blocker — no real evidence values have been imputed

Stopped at source access, as requested. NASA documents Earthdata login for browser
downloads and an Earthdata token for scripted downloads. No account was created,
no token was requested, and no satellite granules were downloaded.

## Steps for the team

1. Sign in to your own Earthdata account through the LAADS website. If you do not
   have an account, create it yourself only if you choose to proceed.
2. Follow NASA's [Find Data guide](https://ladsweb.modaps.eosdis.nasa.gov/learn/how-to-search-and-order-data-with-the-laads-find-data-interface/).
   Select **VNP46A2**, collection **002**, and search the two regions separately:

| Region | Date range to retrieve (inclusive UTC calendar dates) |
|---|---|
| Puerto Rico, including Vieques | 2017-09-13 through 2017-09-23 |
| Kerala, India | 2018-08-07 through 2018-08-17 |

3. Use a drawn regional polygon or geographic bounds, then select **FILES**.
   Keep the file list and total download size. These are retrieval envelopes,
   not a claim that each daily observation falls within the exact analysis window.
4. Review the file count/size before any bulk download. Send the file list/size
   or tell me that sign-in is ready so a bounded selection can be prepared.
   Do not download the global archive. I have not verified the total size.
5. If you already have these granules, give their local folder path instead.
   Keep original HDF5 files and metadata, including radiance and quality layers.
   Do not paste credentials or tokens into the chat.

For scripted access, NASA's [token instructions](https://ladsweb.modaps.eosdis.nasa.gov/learn/download-files-using-edl-tokens/)
explain how to obtain and store a token. No credentials are needed in Git.

## Alignment that must be resolved before analysis

The dates above come from the workbook's input `events` sheet, not real outcomes.
Its exact windows are:

- Maria baseline starts 2017-09-13 10:15 UTC; impact is 2017-09-20 10:15 UTC;
  observation ends 2017-09-23 10:15 UTC.
- Kerala baseline starts 2018-08-07 18:30 UTC; impact is 2018-08-14 18:30 UTC;
  observation ends 2018-08-17 18:30 UTC.

Use valid radiance observations and quality flags; missing/cloudy pixels must not
be assigned zero. Gap-filled values must be distinguished from fresh observations.
The [NASA product description](https://viirsland.gsfc.nasa.gov/Products/NASA/BlackMarble.html)
lists radiance, gap-filled radiance, retrieval-age, cloud, and quality fields.
Municipal/district aggregation also requires licensed real boundaries, which have
not been downloaded or approved separately yet. Dataset centroids are insufficient.

FCC and official evacuation/camp evidence have not yet been collected because the
user required stopping at an account/manual-access dependency. No real-versus-
simulated evidence comparison, real silence test, or Phase 3 preregistration has
been claimed. Phases 3–6 remain pending. The Phase 4 fresh-seed test also needs
the generator script; the supplied workbook path is not a generator.

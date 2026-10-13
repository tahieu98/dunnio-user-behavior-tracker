INSERT IGNORE INTO tracked_pages(site_id,page_path,title,category)
SELECT id,'/contact','Contact Dunnio Tailor','service' FROM tracking_sites WHERE public_key='dunnio-public-v1';
-- Replace the unverified planning placeholder with the observed public route.
UPDATE tracking_sites
SET goal_paths=JSON_ARRAY('/men/custom-suits','/men/custom-tuxedo','/3d-custom-outfit/suits.html','/3d-custom-outfit/tuxedo.html','/contact')
WHERE public_key='dunnio-public-v1';

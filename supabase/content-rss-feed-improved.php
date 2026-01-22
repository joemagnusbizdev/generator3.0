<?php

/**
 * Template part for displaying rss-feed (Intelligence Alerts)
 * IMPROVED VERSION WITH PROPER SPACING AND ALL ACF FIELDS
 */

// -------------------------
// Country taxonomy + flag (ACF on term)
// -------------------------
$terms   = get_the_terms(get_the_ID(), 'country');
$country = ($terms && !is_wp_error($terms) && !empty($terms)) ? $terms[0]->name : '';
$flag    = ($terms && !is_wp_error($terms) && !empty($terms) && function_exists('get_field'))
  ? get_field('flag', 'country_' . $terms[0]->term_id)
  : null;

// -------------------------
// ACF fields (may be null)
// -------------------------
$location        = function_exists('get_field') ? get_field('the_location') : '';
$description     = function_exists('get_field') ? get_field('description') : '';
$topics          = function_exists('get_field') ? get_field('intelligence_topics') : [];
$severity        = function_exists('get_field') ? get_field('severity') : null;
$latitude        = function_exists('get_field') ? get_field('latitude') : '';
$longitude       = function_exists('get_field') ? get_field('longitude') : '';
$radius          = function_exists('get_field') ? get_field('radius') : '';
$polygon         = function_exists('get_field') ? get_field('polygon') : '';
$start_date      = function_exists('get_field') ? get_field('start') : '';
$end_date        = function_exists('get_field') ? get_field('end') : '';
$recommendations = function_exists('get_field') ? get_field('recommendations') : [];
$mainland        = function_exists('get_field') ? get_field('mainland') : '';

// -------------------------
// Date
// -------------------------
$day   = get_the_date('d');
$month = get_the_date('F');
$year  = get_the_date('Y');

// -------------------------
// Topics HTML
// -------------------------
$topics_html = '';
if (!empty($topics) && is_array($topics)) {
  foreach ($topics as $topic) {
    $topics_html .= '<span class="topic-tag">' . esc_html($topic) . '</span>';
  }
}

// -------------------------
// Decide what to render as "body"
// Prefer ACF description if present, else fall back to editor content.
// -------------------------
$has_acf_description = !empty($description) && is_string($description);
?>

<div class="news_reports">
  <div class="event-item">
    <div class="date-bar">
      <div class="date-wrap">
        <p class="day"><?php echo esc_html($day); ?></p>
        <p class="m-y">
          <span class="month"><?php echo esc_html($month); ?></span>
          <span class="year"><?php echo esc_html($year); ?></span>
        </p>
      </div>
      <span class="dash"></span>
    </div>

    <div class="item-data compact-layout">

      <div class="item-title">
        <?php if (!empty($flag) && is_array($flag) && !empty($flag['url'])): ?>
          <img
            src="<?php echo esc_url($flag['url']); ?>"
            alt="<?php echo esc_attr($flag['alt'] ?? ''); ?>"
            class="country-flag"
          >
        <?php endif; ?>

        <h2 class="title"><?php the_title(); ?></h2>
      </div>

      <?php if (!empty($severity)) :
        $sev_value = is_array($severity) ? ($severity['value'] ?? '') : (string)$severity;
        $sev_label = is_array($severity) ? ($severity['label'] ?? $sev_value) : (string)$severity;
      ?>
        <p class="meta-line"><strong>Severity:</strong> <?php echo esc_html($sev_label); ?></p>
      <?php endif; ?>

      <?php if ($country !== '' || !empty($location) || !empty($mainland)) : ?>
        <p class="meta-line"><strong>Location &amp; Geography:</strong>
          <?php if ($country !== '') : ?> Country: <?php echo esc_html($country); ?><?php endif; ?>
          <?php if (!empty($location)) : ?> &nbsp;City/Location: <?php echo esc_html($location); ?><?php endif; ?>
          <?php if (!empty($mainland)) : ?> &nbsp;Region: <?php echo esc_html($mainland); ?><?php endif; ?>
        </p>
      <?php endif; ?>

      <?php if (!empty($topics_html)) : ?>
        <p class="meta-line"><strong>Topics:</strong> <span class="topics-inline"><?php echo $topics_html; ?></span></p>
      <?php endif; ?>

      <?php if ($has_acf_description): ?>
        <div class="section-block">
          <p class="section-title">Event Details Summary:</p>
          <div class="item-description"><?php echo wpautop(wp_kses_post($description)); ?></div>
        </div>
      <?php else: ?>
        <div class="section-block">
          <p class="section-title">Event Details Summary:</p>
          <div class="item-description"><?php the_content(); ?></div>
        </div>
      <?php endif; ?>

      <?php if (!empty($start_date) || !empty($end_date)) : ?>
        <div class="section-block timeline">
          <p class="section-title">Timeline</p>
          <?php if (!empty($start_date)) : ?>
            <p class="meta-line"><strong>Start:</strong> <?php echo esc_html($start_date); ?></p>
          <?php endif; ?>
          <?php if (!empty($end_date)) : ?>
            <p class="meta-line"><strong>End/Expiration:</strong> <?php echo esc_html($end_date); ?></p>
          <?php endif; ?>
        </div>
      <?php endif; ?>

      <?php if (!empty($recommendations) && is_array($recommendations)) : ?>
        <div class="section-block recommendations">
          <p class="section-title">Safety Precautions</p>
          <ol class="recommendations-list">
            <?php foreach ($recommendations as $rec) : 
              $rec_label = is_array($rec) ? ($rec['label'] ?? $rec) : $rec;
              if (!empty($rec_label)) :
            ?>
              <li class="recommendation-item"><?php echo esc_html($rec_label); ?></li>
            <?php 
              endif;
            endforeach; ?>
          </ol>
        </div>
      <?php endif; ?>

    </div><!-- end .item-data -->
  </div><!-- end .event-item -->
</div><!-- end .news_reports -->

<style>
  .compact-layout { line-height: 1.5; font-size: 15px; color: #192622; }
  .compact-layout .meta-line { margin: 6px 0; }
  .compact-layout .section-block { margin: 12px 0; }
  .compact-layout .section-title { margin: 0 0 6px; font-weight: 700; }
  .compact-layout .item-description p { margin: 0 0 10px; }
  .topics-inline span { display: inline-block; margin-right: 6px; }
  .recommendations-list { margin: 6px 0 0 20px; }
  .recommendations-list li { margin-bottom: 6px; }
  .country-flag { height: 17px; width: 25px; object-fit: cover; margin-right: 8px; display: inline-block; }
</style>

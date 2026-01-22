<?php
class RSSFeedWidget extends WP_Widget {

    public function __construct() {
        parent::__construct(
            'rss_feed_widget',
            __('RSS Feed Widget', 'text_domain'),
            ['description' => __('Displays posts from rss-feed post type', 'text_domain')]
        );
    }

    public function widget($args, $instance) {
        echo $args['before_widget'];

        if (!empty($instance['title'])) {
            echo $args['before_title'] . apply_filters('widget_title', $instance['title']) . $args['after_title'];
        }

        // ==================== OUTPUT CSS FIRST ====================
        $this->output_inline_css();

        $query = new WP_Query([
            'post_type'      => 'rss-feed',
            'posts_per_page' => -1,
            'post_status'    => 'publish',
            'no_found_rows'  => true,
        ]);

        if ($query->have_posts()) {
            echo '<div class="news_reports">';

            while ($query->have_posts()) {
                $query->the_post();
                $post_id = get_the_ID();

                // ==================== TAXONOMY & FLAGS ====================
                $terms = get_the_terms($post_id, 'country');
                $country_name = '';
                $flag = null;

                if ($terms && !is_wp_error($terms) && !empty($terms)) {
                    $country_name = $terms[0]->name;
                    if (function_exists('get_field')) {
                        $flag = get_field('flag', 'country_' . $terms[0]->term_id);
                    }
                }

                // ==================== ACF FIELDS ====================
                $location        = function_exists('get_field') ? get_field('the_location', $post_id) : '';
                $description     = function_exists('get_field') ? get_field('description', $post_id) : '';
                $topics          = function_exists('get_field') ? get_field('intelligence_topics', $post_id) : [];
                $severity        = function_exists('get_field') ? get_field('severity', $post_id) : null;
                $latitude        = function_exists('get_field') ? get_field('latitude', $post_id) : '';
                $longitude       = function_exists('get_field') ? get_field('longitude', $post_id) : '';
                $radius          = function_exists('get_field') ? get_field('radius', $post_id) : '';
                $start_date      = function_exists('get_field') ? get_field('start', $post_id) : '';
                $end_date        = function_exists('get_field') ? get_field('end', $post_id) : '';
                $recommendations = function_exists('get_field') ? get_field('recommendations', $post_id) : [];
                $mainland        = function_exists('get_field') ? get_field('mainland', $post_id) : '';

                // ==================== DATE ====================
                $day   = get_the_date('d', $post_id);
                $month = get_the_date('F', $post_id);
                $year  = get_the_date('Y', $post_id);

                // ==================== SEVERITY ====================
                $sev_value = '';
                $sev_label = '';
                if (!empty($severity)) {
                    if (is_array($severity)) {
                        $sev_value = (string)($severity['value'] ?? '');
                        $sev_label = (string)($severity['label'] ?? $sev_value);
                    } else {
                        $sev_value = (string)$severity;
                        $sev_label = (string)$severity;
                    }
                }

                // ==================== TOPICS ====================
                $topics_html = '';
                if (!empty($topics) && is_array($topics)) {
                    foreach ($topics as $topic) {
                        $topics_html .= '<span class="topic-tag">' . esc_html($topic) . '</span>';
                    }
                }

                // ==================== CONTENT ====================
                $has_description = !empty($description) && is_string($description);
                $content_html = $has_description
                    ? wp_kses_post($description)
                    : apply_filters('the_content', get_post_field('post_content', $post_id));

                // ==================== OUTPUT ====================
                echo '<div class="event-item">';
                echo '  <div class="date-bar">';
                echo '    <div class="date-wrap">';
                echo '      <p class="day">' . esc_html($day) . '</p>';
                echo '      <p class="m-y">';
                echo '        <span class="month">' . esc_html($month) . '</span>';
                echo '        <span class="year">' . esc_html($year) . '</span>';
                echo '      </p>';
                echo '    </div>';
                echo '    <span class="dash"></span>';
                echo '  </div>';

                echo '  <div class="item-data compact-layout">';

                // Use table for guaranteed layout
                echo '    <table class="alert-layout-table" style="width: 100%; border-collapse: collapse;">';

                // TITLE WITH FLAG
                echo '    <tr><td style="padding: 8px 0; display: block;">';
                echo '      <div class="item-title">';
                if (!empty($flag) && is_array($flag) && !empty($flag['url'])) {
                    echo '        <img src="' . esc_url($flag['url']) . '" alt="' . esc_attr($flag['alt'] ?? '') . '" class="country-flag">';
                }
                echo '        <h2 class="title">' . esc_html(get_the_title($post_id)) . '</h2>';
                echo '      </div>';
                echo '    </td></tr>';

                // SEVERITY
                if ($sev_label !== '') {
                    echo '    <tr><td style="padding: 6px 0; display: block;"><strong>Severity:</strong> ' . esc_html($sev_label) . '</td></tr>';
                }

                // LOCATION & GEOGRAPHY
                if ($country_name !== '' || !empty($location) || !empty($mainland)) {
                    echo '    <tr><td style="padding: 6px 0; display: block;"><strong>Location &amp; Geography:</strong> ';
                    $geo_parts = [];
                    if ($country_name !== '') {
                        $geo_parts[] = 'Country: ' . esc_html($country_name);
                    }
                    if (!empty($location)) {
                        $geo_parts[] = 'City/Location: ' . esc_html($location);
                    }
                    if (!empty($mainland)) {
                        $geo_parts[] = 'Region: ' . esc_html($mainland);
                    }
                    echo implode(' | ', $geo_parts);
                    echo '</td></tr>';
                }

                // TOPICS
                if ($topics_html !== '') {
                    echo '    <tr><td style="padding: 6px 0; display: block;"><strong>Topics:</strong> ' . $topics_html . '</td></tr>';
                }

                // EVENT DETAILS SUMMARY
                echo '    <tr><td style="padding: 12px 0; display: block;">';
                echo '      <div><strong>Event Details Summary:</strong></div>';
                echo '      <div style="margin-top: 6px;">' . $content_html . '</div>';
                echo '    </td></tr>';

                // TIMELINE
                if (!empty($start_date) || !empty($end_date)) {
                    echo '    <tr><td style="padding: 12px 0; display: block;">';
                    echo '      <div><strong>Timeline</strong></div>';
                    if (!empty($start_date)) {
                        echo '      <div style="margin-top: 4px;"><strong>Start:</strong> ' . esc_html($start_date) . '</div>';
                    }
                    if (!empty($end_date)) {
                        echo '      <div style="margin-top: 4px;"><strong>End/Expiration:</strong> ' . esc_html($end_date) . '</div>';
                    }
                    echo '    </td></tr>';
                }

                // RECOMMENDATIONS
                if (!empty($recommendations) && is_array($recommendations)) {
                    echo '    <tr><td style="padding: 12px 0; display: block;">';
                    echo '      <div><strong>Safety Precautions</strong></div>';
                    echo '      <ol style="margin: 6px 0 0 20px;">';
                    foreach ($recommendations as $rec) {
                        $rec_label = is_array($rec) ? ($rec['label'] ?? $rec) : $rec;
                        if (!empty($rec_label)) {
                            echo '        <li style="margin-bottom: 4px;">' . esc_html($rec_label) . '</li>';
                        }
                    }
                    echo '      </ol>';
                    echo '    </td></tr>';
                }

                echo '    </table>';

                echo '  </div>'; // end .item-data
                echo '</div>'; // end .event-item
            }

            echo '</div>'; // end .news_reports
        }

        wp_reset_postdata();

        echo $args['after_widget'];
    }

    private function output_inline_css() {
        ?>
        <style>
            .news_reports .alert-layout-table td {
                display: block !important;
                width: 100% !important;
            }
            
            .news_reports,
            .news_reports * {
                white-space: normal !important;
            }
            
            .news_reports .event-item {
                display: flex !important;
                flex-direction: column !important;
                position: relative !important;
                margin: 0 0 15px !important;
                width: 100% !important;
            }
            
            .news_reports .event-item > * {
                flex-basis: auto !important;
                width: 100% !important;
            }
            
            .news_reports .item-data {
                display: block !important;
                width: 100% !important;
                white-space: normal !important;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
                word-break: break-word !important;
            }
            
            .news_reports .compact-layout {
                line-height: 1.5 !important;
                font-size: 15px !important;
                color: #192622 !important;
                display: block !important;
                width: 100% !important;
                white-space: normal !important;
            }
            
            .news_reports .meta-line {
                margin: 8px 0 !important;
                padding: 0 !important;
                display: block !important;
                width: 100% !important;
                white-space: normal !important;
                line-height: 1.4 !important;
                clear: both !important;
                float: none !important;
            }
            
            .news_reports .section-block {
                margin: 14px 0 !important;
                padding: 0 !important;
                display: block !important;
                width: 100% !important;
                white-space: normal !important;
                clear: both !important;
                float: none !important;
            }
            
            .news_reports .section-title {
                margin: 0 0 6px 0 !important;
                padding: 0 !important;
                font-weight: 700 !important;
                display: block !important;
                width: 100% !important;
                white-space: normal !important;
            }
            
            .news_reports .item-description {
                display: block !important;
                margin-top: 6px !important;
                width: 100% !important;
                white-space: normal !important;
            }
            
            .news_reports .item-description p {
                margin: 0 0 10px 0 !important;
                padding: 0 !important;
                display: block !important;
                width: 100% !important;
                white-space: normal !important;
                line-height: 1.5 !important;
            }
            
            .news_reports .country-flag {
                height: 17px !important;
                width: 25px !important;
                object-fit: cover !important;
                margin-right: 8px !important;
                display: inline-block !important;
                vertical-align: middle !important;
            }
            
            .news_reports .topics-inline {
                display: block !important;
                margin-top: 4px !important;
                width: 100% !important;
                white-space: normal !important;
            }
            
            .news_reports .topics-inline span {
                display: inline-block !important;
                margin-right: 6px !important;
                margin-bottom: 4px !important;
                white-space: normal !important;
            }
            
            .news_reports .recommendations-list {
                margin: 6px 0 0 20px !important;
                padding: 0 !important;
                display: block !important;
                width: 100% !important;
                white-space: normal !important;
            }
            
            .news_reports .recommendations-list li {
                margin-bottom: 6px !important;
                display: list-item !important;
                width: auto !important;
                white-space: normal !important;
                line-height: 1.4 !important;
            }
            
            .news_reports .item-title {
                display: block !important;
                margin-bottom: 12px !important;
                padding-bottom: 8px !important;
                width: 100% !important;
                white-space: normal !important;
                border-bottom: 1px solid #e0e0e0 !important;
                clear: both !important;
                float: none !important;
            }
            
            .news_reports .item-title h2 {
                display: inline !important;
                margin: 0 !important;
                font-size: 18px !important;
                vertical-align: middle !important;
            }
        </style>
        <?php
    }

    public function form($instance) {
        $title = !empty($instance['title']) ? $instance['title'] : __('RSS Feeds', 'text_domain');
        ?>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('title')); ?>"><?php _e('Title:', 'text_domain'); ?></label>
            <input class="widefat"
                   id="<?php echo esc_attr($this->get_field_id('title')); ?>"
                   name="<?php echo esc_attr($this->get_field_name('title')); ?>"
                   type="text"
                   value="<?php echo esc_attr($title); ?>">
        </p>
        <?php
    }

    public function update($new_instance, $old_instance) {
        $instance = [];
        $instance['title'] = (!empty($new_instance['title'])) ? strip_tags($new_instance['title']) : '';
        return $instance;
    }
}

function register_rss_feed_widget() {
    register_widget('RSSFeedWidget');
}
add_action('widgets_init', 'register_rss_feed_widget');
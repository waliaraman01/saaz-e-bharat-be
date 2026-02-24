require('dotenv').config();
const mongoose = require('mongoose');
const Content = require('../../models/Content');

const seedContent = [
    // Hero Section
    { key: 'hero_title', value: 'Saaz-e-Bharat', section: 'hero' },
    { key: 'hero_subtitle', value: 'भारत की जड़ें, भारत की पहचान', section: 'hero' },
    { key: 'hero_tagline', value: 'A cultural movement celebrating India’s tribal roots', section: 'hero' },
    { key: 'hero_image_1', value: '', section: 'hero' },
    { key: 'hero_image_2', value: '', section: 'hero' },
    { key: 'hero_image_3', value: '', section: 'hero' },
    { key: 'hero_slider_speed', value: 5000, section: 'hero' },
    { key: 'hero_enabled', value: true, section: 'hero' },

    // About Section
    { key: 'about_heading', value: '🌿 About Saaz-e-Bharat', section: 'about' },
    { key: 'about_image', value: '', section: 'about' },
    { key: 'about_p1', value: 'Saaz-e-Bharat is not just a festival — it is a cultural movement that reconnects India with its roots.', section: 'about' },
    { key: 'about_p2', value: 'India’s true identity lives in its soil, in its forests, in its tribal communities — where art is not decoration, music is not performance, and culture is not history, but a way of life. Saaz-e-Bharat is an effort to revive, preserve, and celebrate this living heritage by bringing together the diverse tribal arts, folk traditions, music, crafts, and cuisines of Bharat under one shared platform.', section: 'about' },
    { key: 'about_p3', value: 'From the rhythmic beats of ancient drums to the stories painted on mud walls, from handwoven textiles to age-old folk dances, Saaz-e-Bharat gives voice to traditions that have sustained generations but remained unseen for too long.', section: 'about' },
    { key: 'about_enabled', value: true, section: 'about' },

    // Four Pillars Section
    { key: 'pillars_enabled', value: true, section: 'pillars' },
    { key: 'pillar_1_title', value: 'Preservation', section: 'pillars' },
    { key: 'pillar_1_desc', value: 'Preservation of India’s tribal and folk heritage', section: 'pillars' },
    { key: 'pillar_2_title', value: 'Empowerment', section: 'pillars' },
    { key: 'pillar_2_desc', value: 'Economic and social empowerment of tribal communities', section: 'pillars' },
    { key: 'pillar_3_title', value: 'Unity in Diversity', section: 'pillars' },
    { key: 'pillar_3_desc', value: 'Celebrating every region, every art form', section: 'pillars' },
    { key: 'pillar_4_title', value: 'Youth & Pride', section: 'pillars' },
    { key: 'pillar_4_desc', value: 'Inspiring the youth to embrace their roots with pride', section: 'pillars' },

    // Vision Section
    { key: 'vision_heading', value: 'A National Movement with a Global Vision', section: 'vision' },
    { key: 'vision_p1', value: 'Saaz-e-Bharat is designed as a national celebration, with a vision to expand across all states of India and eventually the world, showcasing Bharat’s cultural soul on a global stage.', section: 'vision' },
    { key: 'vision_p2', value: 'It is a space where artists, artisans, performers, food custodians, and cultural storytellers come together — not as exhibits, but as the heart of the experience.', section: 'vision' },
    { key: 'vision_p3', value: 'More than an event, Saaz-e-Bharat is a reminder: Tribal India is not a forgotten chapter of history — it is the foundation of a new, culturally conscious future.', section: 'vision' },
    { key: 'vision_enabled', value: true, section: 'vision' },

    // CTA Section
    { key: 'cta_text', value: 'Join the Celebration', section: 'cta' },
    { key: 'cta_subtext', value: 'Be part of a movement that celebrates India’s living heritage', section: 'cta' },
    { key: 'cta_link', value: '/join-the-celebration', section: 'cta' },
    { key: 'cta_enabled', value: true, section: 'cta' },
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        for (const item of seedContent) {
            await Content.findOneAndUpdate(
                { key: item.key },
                item,
                { upsert: true, new: true }
            );
        }

        console.log('Content seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding content:', error);
        process.exit(1);
    }
};

seedDB();

ALTER TABLE public.registration_topics 
ADD CONSTRAINT registration_topics_registration_id_fkey 
FOREIGN KEY (registration_id) REFERENCES registrations(id);

-- Cada posição deve ser única dentro da própria categoria.
alter table public.galeria
add constraint galeria_categoria_ordem_unique unique (categoria, ordem);

-- Script SQL para criar o banco de dados e tabelas
USE master;
GO

-- Criar o banco de dados
CREATE DATABASE usuarios;
GO

-- Usar o banco de dados criado
USE usuarios;
GO

-- Criar a tabela de usuários
CREATE TABLE Users (
    UserID INT PRIMARY KEY,
    Username NVARCHAR(50) NOT NULL,
    Password NVARCHAR(50) NOT NULL
);
GO
